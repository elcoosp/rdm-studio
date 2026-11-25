//! EN 1990 (Eurocode 0) load combinations.
//!
//! The solver produces one result vector per elementary case; this module
//! superimposes them into the ULS and SLS combinations of EN 1990 §6.4:
//!
//! - ULS (STR, expression 6.10 with a single leading variable action):
//!   `1.35 * G + 1.50 * V_lead + sum(psi0_j * V_j)` — with only `Q`
//!   present this is the plan's canonical `1.35G + 1.50Q`.
//! - SLS (characteristic combination, expression 6.14b):
//!   `1.00 * G + 1.00 * V_lead + sum(psi0_j * V_j)`.
//!
//! `psi0` values are the EN 1990 Annex A1 Table A1.1 recommended defaults
//! (imposed `Q`: 0.7, wind `W`: 0.6, snow `S`: 0.5). The `Acc` case is
//! solved for display but never enters the static ULS/SLS envelope.

use rdm_model::LoadCase;

/// Recommended partial and combination factors of the current edition.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Factors {
    /// Permanent-action partial factor `gamma_G` (ULS).
    pub gamma_g: f64,
    /// Variable-action partial factor `gamma_Q` (ULS, leading case).
    pub gamma_q: f64,
    /// Combination factors per variable case (`psi0`, Annex A1 Table A1.1).
    pub psi0: PsiFactors,
}

impl Default for Factors {
    fn default() -> Self {
        Self {
            gamma_g: 1.35,
            gamma_q: 1.5,
            psi0: PsiFactors::default(),
        }
    }
}

/// `psi0` combination factors (EN 1990 Annex A1, Table A1.1).
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct PsiFactors {
    /// Imposed loads (category-unspecified default: 0.7).
    pub q: f64,
    /// Wind actions.
    pub w: f64,
    /// Snow loads (sites up to 1000 m a.s.l.).
    pub s: f64,
}

impl Default for PsiFactors {
    fn default() -> Self {
        Self {
            q: 0.7,
            w: 0.6,
            s: 0.5,
        }
    }
}

/// Kind of serviceability/ultimate combination produced.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CombinationKind {
    /// Ultimate limit state (STR).
    Uls,
    /// Serviceability limit state, characteristic combination.
    Sls,
}

impl CombinationKind {
    /// Short label used in reports.
    pub fn code(self) -> &'static str {
        match self {
            Self::Uls => "ULS",
            Self::Sls => "SLS",
        }
    }
}

/// One superposition recipe: a list of `(elementary case, multiplier)` pairs.
#[derive(Debug, Clone, PartialEq)]
pub struct Combination {
    /// ULS or SLS.
    pub kind: CombinationKind,
    /// Leading variable case (None for a purely permanent model).
    pub leading: Option<LoadCase>,
    /// Multipliers applied to each elementary case.
    pub multipliers: Vec<(LoadCase, f64)>,
}

impl Combination {
    /// Human-readable combination string, e.g. `1.35G + 1.50Q`.
    pub fn label(&self) -> String {
        let mut parts: Vec<String> = Vec::new();
        for (case, factor) in &self.multipliers {
            parts.push(format!("{factor:.2}{}", case.code()));
        }
        parts.join(" + ")
    }
}

/// Builds the ULS and SLS combinations for the set of cases present in the
/// model (permanent `G` is always included).
///
/// Every variable case takes one turn as the leading action; the remaining
/// variable cases enter with their `psi0` factor. With a single variable
/// case this yields exactly `1.35G + 1.50Q` (ULS) and `G + Q` (SLS).
pub fn build_combinations(present: &[LoadCase], factors: &Factors) -> Vec<Combination> {
    let variables: Vec<LoadCase> = present
        .iter()
        .copied()
        .filter(|c| matches!(c, LoadCase::Variable | LoadCase::Wind | LoadCase::Snow))
        .collect();

    let mut combos = Vec::new();
    let leaders: Vec<Option<LoadCase>> = if variables.is_empty() {
        vec![None]
    } else {
        variables.iter().copied().map(Some).collect()
    };

    for leader in leaders {
        // ULS 6.10: 1.35G + 1.50 V_lead + sum psi0 V_j
        let mut uls = vec![(LoadCase::Permanent, factors.gamma_g)];
        for &v in &variables {
            let factor = if Some(v) == leader {
                factors.gamma_q
            } else {
                factors.psi0.of(v)
            };
            uls.push((v, factor));
        }
        combos.push(Combination {
            kind: CombinationKind::Uls,
            leading: leader,
            multipliers: uls,
        });

        // SLS characteristic 6.14b: 1.00G + 1.00 V_lead + sum psi0 V_j
        let mut sls = vec![(LoadCase::Permanent, 1.0)];
        for &v in &variables {
            let factor = if Some(v) == leader {
                1.0
            } else {
                factors.psi0.of(v)
            };
            sls.push((v, factor));
        }
        combos.push(Combination {
            kind: CombinationKind::Sls,
            leading: leader,
            multipliers: sls,
        });
    }
    combos
}

impl PsiFactors {
    /// `psi0` of one variable case.
    pub fn of(self, case: LoadCase) -> f64 {
        match case {
            LoadCase::Variable => self.q,
            LoadCase::Wind => self.w,
            LoadCase::Snow => self.s,
            LoadCase::Permanent | LoadCase::Acceleration => 0.0,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use approx::assert_abs_diff_eq;

    #[test]
    fn single_variable_case_matches_canonical_formula() {
        let combos = build_combinations(
            &[LoadCase::Permanent, LoadCase::Variable],
            &Factors::default(),
        );
        assert_eq!(combos.len(), 2);
        let uls = &combos[0];
        assert_eq!(uls.kind, CombinationKind::Uls);
        assert_eq!(uls.label(), "1.35G + 1.50Q");
        assert_abs_diff_eq!(
            uls.multipliers
                .iter()
                .find(|(c, _)| *c == LoadCase::Permanent)
                .map(|(_, f)| *f)
                .unwrap_or_default(),
            1.35
        );
        let sls = &combos[1];
        assert_eq!(sls.label(), "1.00G + 1.00Q");
    }

    #[test]
    fn each_variable_case_leads_once_with_psi0_for_others() {
        let cases = [
            LoadCase::Permanent,
            LoadCase::Variable,
            LoadCase::Wind,
            LoadCase::Snow,
        ];
        let combos = build_combinations(&cases, &Factors::default());
        assert_eq!(combos.len(), 6, "3 leaders x (ULS+SLS)");
        let wind_leading_uls = combos
            .iter()
            .find(|c| c.kind == CombinationKind::Uls && c.leading == Some(LoadCase::Wind))
            .unwrap();
        let factor_of = |case: LoadCase| {
            wind_leading_uls
                .multipliers
                .iter()
                .find(|(c, _)| *c == case)
                .map(|(_, f)| *f)
                .unwrap_or_default()
        };
        assert_abs_diff_eq!(factor_of(LoadCase::Wind), 1.5);
        assert_abs_diff_eq!(factor_of(LoadCase::Variable), 0.7);
        assert_abs_diff_eq!(factor_of(LoadCase::Snow), 0.5);
    }

    #[test]
    fn acceleration_case_never_enters_combinations() {
        let combos = build_combinations(
            &[
                LoadCase::Permanent,
                LoadCase::Variable,
                LoadCase::Acceleration,
            ],
            &Factors::default(),
        );
        for combo in &combos {
            assert!(
                combo
                    .multipliers
                    .iter()
                    .all(|(c, _)| *c != LoadCase::Acceleration)
            );
        }
    }

    #[test]
    fn permanent_only_model_gets_identity_combinations() {
        let combos = build_combinations(&[LoadCase::Permanent], &Factors::default());
        assert_eq!(combos.len(), 2);
        assert_eq!(combos[0].label(), "1.35G");
        assert_eq!(combos[1].label(), "1.00G");
    }
}
