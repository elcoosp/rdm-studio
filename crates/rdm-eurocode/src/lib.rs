//! Data-driven normative engine for RDM Studio: EN 1990 (Eurocode 0) load
//! combinations and EN 1993-1-1 (Eurocode 3) member checks.
//!
//! All profile tables and material properties live in `data/*.json` embedded
//! at compile time via [`include_str!`] — adding a profile series or a new
//! standard requires **zero code changes** in the UI (ARCHITECTURE.md §7).
//!
//! The catalog layer resolves an EN designation (e.g. `IPE 200`) into the
//! generic [`rdm_model::SectionProperties`] consumed by the solver, so the
//! solver never touches normative data.

pub mod catalog;
pub mod en1990;
pub mod en1993;

pub use catalog::{Ec3Error, MaterialCatalog, ProfileCatalog, ProfileEntry, ProfileFamily};
pub use en1990::{Combination, CombinationKind, Factors, PsiFactors, build_combinations};
pub use en1993::{
    BucklingCurve, Classification, DeflectionLimit, GAMMA_M0, LtbResult, MemberCheck,
    MemberCheckInput, buckling_curve_rolled, classify_section, deflection_limit,
    euler_critical_force, flexural_buckling_chi, lambda_bar, lateral_torsional_buckling,
    member_check, reduce_to_bending_shear, shear_area_major, shear_area_minor, von_mises_stress,
    von_mises_utilisation,
};

use std::sync::OnceLock;

/// Returns the embedded EN 10365 / EN 10210 / EN 10056 profile catalogs.
///
/// # Panics
///
/// Panics only if the compile-time embedded JSON were malformed, which the
/// committed snapshot tests make impossible.
pub fn profile_catalog() -> &'static ProfileCatalog {
    static CATALOG: OnceLock<ProfileCatalog> = OnceLock::new();
    CATALOG.get_or_init(|| {
        ProfileCatalog::parse_catalog_strs(
            include_str!("../data/en10365_profiles.json"),
            include_str!("../data/en10210_hollow.json"),
            include_str!("../data/en10056_angles.json"),
        )
        .expect("embedded profile catalogs must parse")
    })
}

/// Returns the embedded EN 10025 / EN 10088 / EN AW material catalog.
///
/// # Panics
///
/// Panics only if the compile-time embedded JSON were malformed, which the
/// committed snapshot tests make impossible.
pub fn material_catalog() -> &'static MaterialCatalog {
    static CATALOG: OnceLock<MaterialCatalog> = OnceLock::new();
    CATALOG.get_or_init(|| {
        MaterialCatalog::parse_str(include_str!("../data/en10025_materials.json"))
            .expect("embedded material catalog must parse")
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn embedded_catalogs_parse_and_are_populated() {
        assert!(profile_catalog().len() >= 140);
        assert!(material_catalog().len() >= 7);
    }
}
