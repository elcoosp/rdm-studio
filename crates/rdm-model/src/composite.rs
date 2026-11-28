//! Multi-element composite cross-section definitions (M11.1).

//! A [`CompositeSectionDef`] is the user-authored description of a built-up
//! section: `1..N` sub-elements, each an EN catalog profile, a parametric
//! plate, a CHS or an RHS/SHS, placed at a local offset `(dy, dz)` (m),
//! rotated by `theta` (rad) about its own centroid and optionally mirrored.
//! The definition is persisted verbatim on [`crate::Structure`]
//! (`custom_sections`, schema v2); the exact analytical mechanics live in
//! `rdm-cad::sections` and the WASM bridge resolves a definition into the
//! same [`crate::SectionProperties`] table every catalog profile uses, so
//! beams referencing a composite section solve natively.

use serde::{Deserialize, Serialize};

/// Structural steel grade of a composite section (EN 10025 nominal values).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
pub enum SteelGrade {
    /// S235 — `fy = 235 MPa`.
    #[default]
    S235,
    /// S275 — `fy = 275 MPa`.
    S275,
    /// S355 — `fy = 355 MPa`.
    S355,
    /// S460 — `fy = 460 MPa`.
    S460,
}

impl SteelGrade {
    /// Nominal yield strength `fy` (Pa).
    #[must_use]
    pub fn fy(self) -> f64 {
        match self {
            Self::S235 => 235.0e6,
            Self::S275 => 275.0e6,
            Self::S355 => 355.0e6,
            Self::S460 => 460.0e6,
        }
    }

    /// Wire code used by the UI (`S235`..`S460`).
    #[must_use]
    pub fn code(self) -> &'static str {
        match self {
            Self::S235 => "S235",
            Self::S275 => "S275",
            Self::S355 => "S355",
            Self::S460 => "S460",
        }
    }

    /// Parses a wire code; unknown codes fall back to the default grade.
    #[must_use]
    pub fn parse(code: &str) -> Self {
        match code {
            "S275" => Self::S275,
            "S355" => Self::S355,
            "S460" => Self::S460,
            _ => Self::S235,
        }
    }
}

/// One sub-element of a composite section (M11.1).
/// The `kind` payload carries the normative dimensions in strict SI units
/// (`m`); placement fields position the element **centroid** in the
/// composite frame, so `dy = dz = 0` always means "centred on the origin".
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CompositeElement {
    /// Element kind + normative dimensions (SI).
    #[serde(flatten)]
    pub kind: CompositeElementKind,
    /// Centroid offset along the composite `y` axis (m).
    #[serde(default)]
    pub dy: f64,
    /// Centroid offset along the composite `z` axis (m).
    #[serde(default)]
    pub dz: f64,
    /// In-plane rotation about the element centroid (rad).
    #[serde(default)]
    pub theta: f64,
    /// Mirrors the element about its own local `z` axis before rotating.
    #[serde(default)]
    pub mirror_y: bool,
    /// Mirrors the element about its own local `y` axis before rotating.
    #[serde(default)]
    pub mirror_z: bool,
}

/// Kind + dimensions of one composite sub-element.
/// `plate` is a parametric rectangle `length` (local y) x `thickness`
/// (local z); `profile` resolves an EN 10365 / EN 10210 / EN 10056
/// designation through the embedded catalogs; `chs` / `rhs` are parametric
/// hollow shapes (`rhs` covers SHS with `width = height`).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum CompositeElementKind {
    /// Parametric plate `length x thickness` (m), long side along local y.
    Plate {
        /// Plate length along the local `y` axis (m).
        length: f64,
        /// Plate thickness along the local `z` axis (m).
        thickness: f64,
    },
    /// Catalog profile designation (e.g. `IPE 300`, `UPN 200`, `L 100x100x10`).
    Profile {
        /// EN designation resolved through `rdm-eurocode::profile_catalog`.
        designation: String,
    },
    /// Circular hollow section `diameter x thickness` (m).
    Chs {
        /// Outer diameter (m).
        diameter: f64,
        /// Wall thickness (m).
        thickness: f64,
    },
    /// Rectangular hollow section `height x width x thickness` (m).
    Rhs {
        /// Overall depth along the local `z` axis (m).
        height: f64,
        /// Overall width along the local `y` axis (m).
        width: f64,
        /// Wall thickness (m).
        thickness: f64,
    },
}

/// User-authored built-up cross-section persisted on the model (M11.1).
/// Beams reference the section through `section_id == name`; the WASM
/// bridge computes the exact mechanical properties and joins the
/// `Structure::sections` table before validation and solving.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CompositeSectionDef {
    /// Unique section name (the `section_id` beams reference).
    pub name: String,
    /// Steel grade driving the EN 1993-1-1 Table 5.2 classification.
    #[serde(default)]
    pub grade: SteelGrade,
    /// Sub-elements (`1..N`).
    #[serde(default)]
    pub elements: Vec<CompositeElement>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn grades_carry_the_en_10025_nominal_values() {
        assert_abs_diff_eq!(SteelGrade::S235.fy(), 235.0e6);
        assert_abs_diff_eq!(SteelGrade::S460.fy(), 460.0e6);
        assert_eq!(SteelGrade::parse("S355"), SteelGrade::S355);
        assert_eq!(SteelGrade::parse("S999"), SteelGrade::S235);
    }

    #[test]
    fn element_kind_serde_uses_the_tagged_snake_case_wire_format() {
        let element: CompositeElement =
            serde_json::from_str(r#"{"kind":"plate","length":0.15,"thickness":0.01,"dz":0.1446}"#)
                .expect("parse plate");
        assert_eq!(
            element.kind,
            CompositeElementKind::Plate {
                length: 0.15,
                thickness: 0.01
            }
        );
        assert_abs_diff_eq!(element.dz, 0.1446);
        assert_abs_diff_eq!(element.theta, 0.0);
        let profile: CompositeElement =
            serde_json::from_str(r#"{"kind":"profile","designation":"IPE 300","dy":0.0,"dz":0.0}"#)
                .expect("parse profile");
        assert_eq!(
            profile.kind,
            CompositeElementKind::Profile {
                designation: "IPE 300".to_owned()
            }
        );
    }

    #[test]
    fn composite_section_def_defaults_grade_and_elements() {
        let def: CompositeSectionDef = serde_json::from_str(
            r#"{"name":"PRS-300","elements":[{"kind":"chs","diameter":0.1,"thickness":0.006}]}"#,
        )
        .expect("parse def");
        assert_eq!(def.grade, SteelGrade::S235);
        assert_eq!(def.elements.len(), 1);
    }

    use approx::assert_abs_diff_eq;
}
