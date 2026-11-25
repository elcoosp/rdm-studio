//! EN 1998-1 modal response spectrum analysis (v1.9.0): elastic
//! Type 1 / Type 2 spectra per ground type A..E, modal mass
//! participation and CQC / SRSS combination of modal responses.

/// Ground types of EN 1998-1 Table 3.1.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum GroundType {
    A,
    B,
    C,
    D,
    E,
}

/// Spectrum type of EN 1998-1 §3.2.2.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SpectrumType {
    Type1,
    Type2,
}

/// Elastic spectrum parameters `S, TB, TC, TD` (Table 3.2 / 3.3).
#[must_use]
pub fn spectrum_parameters(ground: GroundType, spectrum: SpectrumType) -> (f64, f64, f64, f64) {
    match spectrum {
        SpectrumType::Type1 => match ground {
            GroundType::A => (1.0, 0.15, 0.4, 2.0),
            GroundType::B => (1.2, 0.15, 0.5, 2.0),
            GroundType::C => (1.35, 0.15, 0.6, 2.0),
            GroundType::D => (1.35, 0.20, 0.8, 2.0),
            GroundType::E => (1.35, 0.15, 0.5, 2.0),
        },
        SpectrumType::Type2 => match ground {
            GroundType::A => (1.0, 0.05, 0.25, 1.2),
            GroundType::B => (1.35, 0.05, 0.25, 1.2),
            GroundType::C => (1.5, 0.10, 0.25, 1.2),
            GroundType::D => (1.8, 0.10, 0.30, 1.2),
            GroundType::E => (1.6, 0.05, 0.25, 1.2),
        },
    }
}

/// Elastic response `Se(T)` (× g) of §3.2.2.2 with 5 % damping.
#[must_use]
pub fn elastic_spectrum(t: f64, ag_g: f64, ground: GroundType, spectrum: SpectrumType) -> f64 {
    let (s, tb, tc, td) = spectrum_parameters(ground, spectrum);
    let t = t.max(0.0);
    if t <= tb {
        ag_g * s * (2.5 + (t / tb) * 0.5)
    } else if t <= tc {
        ag_g * s * 2.5
    } else if t <= td {
        ag_g * s * 2.5 * (tc / t)
    } else {
        ag_g * s * 2.5 * (tc * td / (t * t))
    }
}

/// Modal response of one mode.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct ModalResponse {
    /// Mode index (1-based).
    pub mode_index: usize,
    /// Natural frequency (Hz).
    pub frequency_hz: f64,
    /// Modal mass ratio (participation, fraction of the total mass).
    pub mass_ratio: f64,
    /// Spectral acceleration (× g).
    pub spectral_g: f64,
}

/// Combined response via SRSS (square root of sum of squares).
#[must_use]
pub fn combine_srss(responses: &[ModalResponse]) -> f64 {
    responses
        .iter()
        .map(|r| (r.mass_ratio * r.spectral_g).powi(2))
        .sum::<f64>()
        .sqrt()
}

/// Der Kiureghian modal correlation coefficient (equal 5 % damping).
#[must_use]
fn correlation(beta: f64) -> f64 {
    let zeta = 0.05_f64;
    if beta <= 0.0 {
        return 0.0;
    }
    if beta >= 0.999 {
        return 1.0;
    }
    let b = beta;
    let numerator = 8.0 * zeta * zeta * (1.0 + b) * b.powf(2.5);
    let denominator = (1.0 - b * b).powi(4) + 4.0 * zeta * zeta * b * (1.0 - b * b).powi(2);
    if denominator <= 0.0 {
        return 1.0;
    }
    (numerator / denominator).clamp(0.0, 1.0)
}

/// Combined response via CQC (complete quadratic combination, §B.1):
/// `R = √(ΣΣ ρij·Mi·Mj)` with `Mi = mi·Se,i`.
#[must_use]
pub fn combine_cqc(responses: &[ModalResponse]) -> f64 {
    let n = responses.len();
    let mut total = 0.0_f64;
    for i in 0..n {
        for j in 0..n {
            let wi = std::f64::consts::TAU * responses[i].frequency_hz;
            let wj = std::f64::consts::TAU * responses[j].frequency_hz;
            let beta = if wi.abs() < 1e-9 || wj.abs() < 1e-9 {
                0.0
            } else {
                let ratio = (wi / wj).abs();
                ratio.min(1.0 / ratio)
            };
            let rho = if i == j { 1.0 } else { correlation(beta) };
            total += rho
                * responses[i].mass_ratio
                * responses[i].spectral_g
                * responses[j].mass_ratio
                * responses[j].spectral_g;
        }
    }
    total.max(0.0).sqrt()
}

/// Cumulative effective modal mass ratio of the taken modes.
#[must_use]
pub fn cumulative_mass_ratio(responses: &[ModalResponse]) -> f64 {
    responses.iter().map(|r| r.mass_ratio).sum()
}

#[cfg(test)]
mod tests {
    use super::*;
    use approx::{assert_abs_diff_eq, assert_relative_eq};

    #[test]
    fn plateau_is_ag_s_times_two_point_five() {
        let se = elastic_spectrum(0.3, 0.35, GroundType::B, SpectrumType::Type1);
        assert_abs_diff_eq!(se, 0.35 * 1.2 * 2.5, epsilon = 1e-9);
    }

    #[test]
    fn descending_branch_decays_with_t() {
        let t1 = elastic_spectrum(1.0, 0.35, GroundType::A, SpectrumType::Type1);
        let t2 = elastic_spectrum(2.0, 0.35, GroundType::A, SpectrumType::Type1);
        assert!(t1 > t2);
        assert_relative_eq!(t2, 0.35 * 1.0 * 2.5 * (0.4 * 2.0 / 4.0), epsilon = 1e-9);
    }

    #[test]
    fn srss_of_one_mode_is_the_mode_itself() {
        let responses = vec![ModalResponse {
            mode_index: 1,
            frequency_hz: 2.0,
            mass_ratio: 0.8,
            spectral_g: 1.0,
        }];
        assert_abs_diff_eq!(combine_srss(&responses), 0.8, epsilon = 1e-9);
    }

    #[test]
    fn cqc_equals_srss_for_well_separated_modes() {
        let responses = vec![
            ModalResponse {
                mode_index: 1,
                frequency_hz: 2.0,
                mass_ratio: 0.6,
                spectral_g: 1.0,
            },
            ModalResponse {
                mode_index: 2,
                frequency_hz: 9.0,
                mass_ratio: 0.3,
                spectral_g: 1.0,
            },
        ];
        let srss = combine_srss(&responses);
        let cqc = combine_cqc(&responses);
        assert!((srss - cqc).abs() < 0.02 * srss.max(1e-9));
    }

    #[test]
    fn cumulative_mass_sums() {
        let responses = vec![
            ModalResponse {
                mode_index: 1,
                frequency_hz: 2.0,
                mass_ratio: 0.85,
                spectral_g: 1.0,
            },
            ModalResponse {
                mode_index: 2,
                frequency_hz: 8.0,
                mass_ratio: 0.10,
                spectral_g: 0.8,
            },
        ];
        assert_abs_diff_eq!(cumulative_mass_ratio(&responses), 0.95, epsilon = 1e-9);
    }
}
