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

pub mod annex;
pub mod catalog;
pub mod custom_section;
pub mod en1990;
pub mod en1991;
pub mod en1993;
pub mod interaction;
pub mod multi_material;
pub mod optimizer;

pub use annex::annex_factors;
pub use catalog::{Ec3Error, MaterialCatalog, ProfileCatalog, ProfileEntry, ProfileFamily};
pub use custom_section::{circular_hollow, rectangular_hollow, solid_rect, solid_round, welded_i};
pub use en1990::{
    Combination, CombinationKind, Factors, PsiFactors, build_combinations, build_combinations_v2,
    pattern_live_loads,
};
pub use en1991::{
    ImposedCategory, WindParameters, imposed_load, imposed_qk, peak_velocity_pressure, snow_load,
    wind_load,
};
pub use en1993::{
    BucklingCurve, Classification, DeflectionLimit, GAMMA_M0, LtbResult, MemberCheck,
    MemberCheckInput, buckling_curve_rolled, classify_section, deflection_limit,
    euler_critical_force, flexural_buckling_chi, lambda_bar, lateral_torsional_buckling,
    member_check, reduce_to_bending_shear, shear_area_major, shear_area_minor, von_mises_stress,
    von_mises_utilisation,
};
pub use interaction::{
    CalcTraceNode, InteractionAnnex, InteractionInput, annex_a_factors, annex_b_factors,
    c1_from_moment_ratio, class4_reduction, interaction_6_61_6_62, torsional_buckling_ncr,
};
pub use multi_material::{
    AluminiumAlloy, BoltGrade, BoltSize, ConcreteClass, ConnectionInput, ConnectionResult,
    JointTopology, LoadDuration, TimberProduct, aluminium_properties, concrete_fcd, concrete_fck,
    ec2_flexure_as, ec2_shear, ec3_beta_w, ec3_block_tearing_net_shear_area,
    ec3_block_tearing_resistance, ec3_bolt_bearing_resistance, ec3_bolt_combined_shear_tension,
    ec3_bolt_shear_resistance, ec3_bolt_tension_resistance, ec3_connection_check, ec3_fillet_weld,
    ec3_fillet_weld_strength, ec3_fire_check, ec3_fire_critical_temperature, ec3_joint_bolt_shear,
    ec3_steel_fu, ec5_timber_bending, ec9_aluminium_check, timber_kmod, timber_properties,
};
pub use optimizer::{
    CARBON_KG_PER_KG_STEEL, COST_EUR_PER_KG_STEEL, CandidateCheck, GroupDemand, GroupOptimization,
    OptimizationTotals, ProfileCandidate, check_candidate, optimize_group, totals,
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
