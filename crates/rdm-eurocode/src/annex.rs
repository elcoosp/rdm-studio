//! National Annex partial factors (v1.7.0): `γM0 / γM1 / γM2` per
//! `FR | BE | DE | UK | EN`. The recommended (EN) values are the
//! fallback of every national choice; national deviations follow the
//! published NA tables.

use rdm_model::NationalAnnex;

/// Partial material factors of one National Annex.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct AnnexFactors {
    /// `γM0` — cross-section resistance checks.
    pub gamma_m0: f64,
    /// `γM1` — member instability checks.
    pub gamma_m1: f64,
    /// `γM2` — net section / connection resistance.
    pub gamma_m2: f64,
}

/// Returns the partial factors of `annex`.
///
/// Values: EN recommended `1.0 / 1.0 / 1.25`; FR / DE / BE keep the
/// recommended set (their NAs do not deviate for hot-rolled steel);
/// UK NA uses `1.0 / 1.0 / 1.25` as published in BS EN 1993-1-1:2005
/// UK NA. The explicit table keeps the door open for future deviations.
#[must_use]
pub fn annex_factors(annex: NationalAnnex) -> AnnexFactors {
    match annex {
        NationalAnnex::FR
        | NationalAnnex::BE
        | NationalAnnex::DE
        | NationalAnnex::UK
        | NationalAnnex::EN => AnnexFactors {
            gamma_m0: 1.0,
            gamma_m1: 1.0,
            gamma_m2: 1.25,
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use approx::assert_abs_diff_eq;

    #[test]
    fn recommended_values_are_the_default_set() {
        for annex in [
            NationalAnnex::FR,
            NationalAnnex::BE,
            NationalAnnex::DE,
            NationalAnnex::UK,
            NationalAnnex::EN,
        ] {
            let f = annex_factors(annex);
            assert_abs_diff_eq!(f.gamma_m0, 1.0);
            assert_abs_diff_eq!(f.gamma_m1, 1.0);
            assert_abs_diff_eq!(f.gamma_m2, 1.25);
        }
    }
}
