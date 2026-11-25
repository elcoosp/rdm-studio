//! Embedded profile and material catalogs (EN 10365, EN 10210/10219,
//! EN 10056, EN 10025/10088/EN AW-6061).
//!
//! Each JSON file carries a `meta.units` marker (`SI`) and its entries are
//! converted straight into [`rdm_model::SectionProperties`] /
//! [`rdm_model::MaterialProperties`]. Optional fields (`Iw`, `Wpl`, profile
//! dimensions for hollow sections) stay `None` when the source table does
//! not publish them — the checks treat those as "not applicable" instead of
//! guessing.

use std::collections::BTreeMap;

use serde::Deserialize;

use rdm_model::{MaterialProperties, SectionProperties, SectionShape};

/// Normative-layer errors.
#[derive(Debug, Clone, PartialEq, thiserror::Error)]
pub enum Ec3Error {
    /// A designation is not present in the embedded profile catalogs.
    #[error("unknown profile designation \"{0}\"")]
    UnknownProfile(String),
    /// A designation is not present in the embedded material catalog.
    #[error("unknown material designation \"{0}\"")]
    UnknownMaterial(String),
    /// An embedded catalog file failed to parse.
    #[error("catalog parse error: {0}")]
    CatalogParse(String),
    /// A check cannot be performed with the available data.
    #[error("check unavailable: {0}")]
    CheckUnavailable(String),
}

/// Shape family recorded in the JSON catalogs.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum ProfileFamily {
    /// IPE series.
    Ipe,
    /// HEA series.
    Hea,
    /// HEB series.
    Heb,
    /// HEM series.
    Hem,
    /// UPN series (tapered flanges).
    Upn,
    /// UPE series (parallel flanges).
    Upe,
    /// Circular hollow sections.
    Chs,
    /// Square hollow sections.
    Shs,
    /// Rectangular hollow sections.
    Rhs,
    /// Equal-leg angles.
    L,
}

impl ProfileFamily {
    /// Maps the catalog family onto the model shape used by EN 1993 rules.
    pub fn shape(self) -> SectionShape {
        match self {
            Self::Ipe | Self::Hea | Self::Heb | Self::Hem => SectionShape::DoubleSymmetricI,
            Self::Upn | Self::Upe => SectionShape::Channel,
            Self::Chs => SectionShape::CircularHollow,
            Self::Shs | Self::Rhs => SectionShape::RectangularHollow,
            Self::L => SectionShape::Angle,
        }
    }

    /// EN standard the family belongs to (used in reports).
    pub fn standard(self) -> &'static str {
        match self {
            Self::Ipe | Self::Hea | Self::Heb | Self::Hem | Self::Upn | Self::Upe => "EN 10365",
            Self::Chs | Self::Shs | Self::Rhs => "EN 10210/10219",
            Self::L => "EN 10056",
        }
    }
}

/// One profile row as stored in the JSON files.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct ProfileEntry {
    /// EN designation, e.g. `IPE 200`, `CHS 114.3x6`, `L 40x40x4`.
    pub designation: String,
    /// Series family.
    pub family: ProfileFamily,
    /// Area (m²).
    pub a: f64,
    /// Strong-axis second moment (m⁴).
    pub iy: f64,
    /// Weak-axis second moment (m⁴); equals `iy` for CHS.
    pub iz: f64,
    /// St-Venant torsion constant (m⁴).
    pub it: f64,
    /// Warping constant (m⁶) when tabulated.
    pub iw: Option<f64>,
    /// Strong-axis elastic modulus (m³).
    pub wel_y: f64,
    /// Weak-axis elastic modulus (m³).
    pub wel_z: f64,
    /// Strong-axis plastic modulus (m³) when tabulated.
    pub wpl_y: Option<f64>,
    /// Weak-axis plastic modulus (m³) when tabulated.
    pub wpl_z: Option<f64>,
    // Dimensional fields, present for EN 10365 open profiles:
    /// Depth (m).
    pub h: Option<f64>,
    /// Width (m).
    pub b: Option<f64>,
    /// Web thickness (m).
    pub tw: Option<f64>,
    /// Flange thickness (m).
    pub tf: Option<f64>,
    /// Root radius (m).
    pub r: Option<f64>,
    // Hollow/angle dimensional fields:
    /// CHS diameter (m).
    pub d: Option<f64>,
    /// Wall thickness for hollow sections (m).
    pub t: Option<f64>,
    /// Angle leg (m).
    pub a_leg: Option<f64>,
}

/// Combined profile catalog (open + hollow + angle series).
#[derive(Debug, Clone, Default)]
pub struct ProfileCatalog {
    entries: BTreeMap<String, ProfileEntry>,
}

#[derive(Deserialize)]
struct ProfileFile {
    profiles: Vec<ProfileEntry>,
}

impl ProfileCatalog {
    /// Parses the three embedded JSON files into one catalog.
    ///
    /// # Errors
    ///
    /// Returns [`Ec3Error::CatalogParse`] when any embedded file is invalid.
    pub fn from_strs(open: &str, hollow: &str, angles: &str) -> Result<Self, Ec3Error> {
        let mut entries = BTreeMap::new();
        for (text, label) in [
            (open, "en10365_profiles.json"),
            (hollow, "en10210_hollow.json"),
            (angles, "en10056_angles.json"),
        ] {
            let file: ProfileFile = serde_json::from_str(text)
                .map_err(|e| Ec3Error::CatalogParse(format!("{label}: {e}")))?;
            for entry in file.profiles {
                if entries.insert(entry.designation.clone(), entry).is_some() {
                    return Err(Ec3Error::CatalogParse(format!(
                        "{label}: duplicate designation"
                    )));
                }
            }
        }
        Ok(Self { entries })
    }

    /// Number of profile designations.
    pub fn len(&self) -> usize {
        self.entries.len()
    }

    /// True when the catalog holds no profile.
    pub fn is_empty(&self) -> bool {
        self.entries.is_empty()
    }

    /// Sorted list of designations (for UI pickers).
    pub fn designations(&self) -> Vec<&str> {
        self.entries.keys().map(String::as_str).collect()
    }

    /// All entries of one family, sorted by designation.
    pub fn family(&self, family: ProfileFamily) -> Vec<&ProfileEntry> {
        self.entries
            .values()
            .filter(|e| e.family == family)
            .collect()
    }

    /// Resolves a designation into solver-ready section properties.
    ///
    /// # Errors
    ///
    /// Returns [`Ec3Error::UnknownProfile`] for an unregistered designation.
    pub fn properties(&self, designation: &str) -> Result<SectionProperties, Ec3Error> {
        let entry = self
            .entries
            .get(designation)
            .ok_or_else(|| Ec3Error::UnknownProfile(designation.to_owned()))?;
        Ok(SectionProperties {
            shape: entry.family.shape(),
            a: entry.a,
            iy: entry.iy,
            iz: entry.iz,
            it: entry.it,
            iw: entry.iw,
            wel_y: entry.wel_y,
            wel_z: entry.wel_z,
            wpl_y: entry.wpl_y,
            wpl_z: entry.wpl_z,
            h: entry.h.or(entry.d),
            b: entry.b.or(entry.a_leg),
            tw: entry.tw.or(entry.t),
            tf: entry.tf.or(entry.t),
            r: entry.r,
        })
    }

    /// Convenience lookup returning raw catalog entry.
    ///
    /// # Errors
    ///
    /// Returns [`Ec3Error::UnknownProfile`] for an unregistered designation.
    pub fn entry(&self, designation: &str) -> Result<&ProfileEntry, Ec3Error> {
        self.entries
            .get(designation)
            .ok_or_else(|| Ec3Error::UnknownProfile(designation.to_owned()))
    }
}

#[derive(Deserialize)]
struct MaterialFile {
    materials: Vec<MaterialEntry>,
}

#[derive(Deserialize)]
struct MaterialEntry {
    designation: String,
    fy: f64,
    fu: f64,
    e: f64,
    nu: f64,
    rho: f64,
}

/// Material catalog keyed by designation (`S235JR`, `304L`, `6061-T6`, ...).
#[derive(Debug, Clone, Default)]
pub struct MaterialCatalog {
    entries: BTreeMap<String, MaterialProperties>,
}

impl MaterialCatalog {
    /// Parses the embedded material JSON file.
    ///
    /// # Errors
    ///
    /// Returns [`Ec3Error::CatalogParse`] when the file is invalid.
    pub fn from_str(text: &str) -> Result<Self, Ec3Error> {
        let file: MaterialFile = serde_json::from_str(text)
            .map_err(|e| Ec3Error::CatalogParse(format!("en10025_materials.json: {e}")))?;
        let mut entries = BTreeMap::new();
        for m in file.materials {
            // Steels: G = E / (2 (1 + nu)) per EN 1993-1-1 section 3.2.3.
            let g = m.e / (2.0 * (1.0 + m.nu));
            entries.insert(
                m.designation,
                MaterialProperties {
                    e: m.e,
                    g,
                    nu: m.nu,
                    rho: m.rho,
                    fy: m.fy,
                    fu: m.fu,
                },
            );
        }
        Ok(Self { entries })
    }

    /// Number of materials.
    pub fn len(&self) -> usize {
        self.entries.len()
    }

    /// True when empty.
    pub fn is_empty(&self) -> bool {
        self.entries.is_empty()
    }

    /// Sorted designations.
    pub fn designations(&self) -> Vec<&str> {
        self.entries.keys().map(String::as_str).collect()
    }

    /// Resolves a designation into solver-ready material properties.
    ///
    /// # Errors
    ///
    /// Returns [`Ec3Error::UnknownMaterial`] for an unregistered designation.
    pub fn properties(&self, designation: &str) -> Result<MaterialProperties, Ec3Error> {
        self.entries
            .get(designation)
            .cloned()
            .ok_or_else(|| Ec3Error::UnknownMaterial(designation.to_owned()))
    }
}

/// Marker used by tests to keep error naming consistent.
pub const EC3_ERROR_PREFIX: &str = "ec3";

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{material_catalog, profile_catalog};
    use approx::assert_abs_diff_eq;

    #[test]
    fn ipe200_resolves_with_en_values() {
        let cat = profile_catalog();
        let props = cat.properties("IPE 200").unwrap();
        assert_abs_diff_eq!(props.a, 2.848e-3, epsilon = 1e-9);
        assert_abs_diff_eq!(props.iy, 1.943e-5, epsilon = 1e-11);
        assert_abs_diff_eq!(props.iz, 1.424e-6, epsilon = 1e-12);
        assert_abs_diff_eq!(props.wel_y, 1.943e-4, epsilon = 1e-10);
        assert_abs_diff_eq!(props.wel_z, 2.847e-5, epsilon = 1e-10);
        assert_abs_diff_eq!(props.wpl_y.unwrap_or(0.0), 2.206e-4, epsilon = 1e-10);
        assert_abs_diff_eq!(props.wpl_z.unwrap_or(0.0), 4.461e-5, epsilon = 1e-10);
        assert_abs_diff_eq!(props.iw.unwrap_or(0.0), 1.2746e-8, epsilon = 1e-13);
        assert_abs_diff_eq!(props.h.unwrap_or(0.0), 0.2, epsilon = 1e-9);
    }

    #[test]
    fn en_10365_open_series_are_complete() {
        let cat = profile_catalog();
        let ipe = cat.family(ProfileFamily::Ipe).len();
        let hea = cat.family(ProfileFamily::Hea).len();
        let heb = cat.family(ProfileFamily::Heb).len();
        let hem = cat.family(ProfileFamily::Hem).len();
        assert_eq!(ipe, 18, "IPE 80-600");
        assert_eq!(hea, 19, "HEA 100-600");
        assert_eq!(heb, 19, "HEB 100-600");
        assert_eq!(hem, 15, "HEM 100-400");
    }

    #[test]
    fn chs_it_equals_two_iy() {
        let cat = profile_catalog();
        let props = cat.properties("CHS 114.3x6").unwrap();
        assert_abs_diff_eq!(props.it, 2.0 * props.iy, epsilon = 1e-12);
    }

    #[test]
    fn unknown_designations_error_cleanly() {
        let cat = profile_catalog();
        let err = cat.properties("IPE 999").unwrap_err();
        assert!(matches!(err, Ec3Error::UnknownProfile(_)));
        let mat = material_catalog();
        assert!(matches!(
            mat.properties("S999"),
            Err(Ec3Error::UnknownMaterial(_))
        ));
    }

    #[test]
    fn steel_shear_modulus_follows_en_1993() {
        let mat = material_catalog();
        let s235 = mat.properties("S235JR").unwrap();
        assert_abs_diff_eq!(s235.g, 210e9 / 2.6, epsilon = 1e6);
        assert_abs_diff_eq!(s235.fy, 235e6, epsilon = 1.0);
        let alu = mat.properties("6061-T6").unwrap();
        assert_abs_diff_eq!(alu.fy, 240e6, epsilon = 1.0);
    }
}
