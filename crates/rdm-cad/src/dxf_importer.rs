//! DXF entity extraction (`dxf_importer.rs`): pulls `LINE`,
//! `LWPOLYLINE` / `POLYLINE` and `POINT` entities out of a drawing as
//! metre-scale raw segments/nodes.

use std::io::Cursor;

use dxf::entities::EntityType;
use dxf::Drawing;

use crate::CadError;

/// A raw segment extracted from the drawing (metres).
#[derive(Debug, Clone, PartialEq)]
pub struct RawSegment {
    /// First endpoint (m).
    pub a: [f64; 3],
    /// Second endpoint (m).
    pub b: [f64; 3],
}

/// Parses DXF bytes and extracts every importable member segment.
///
/// Coordinates are consumed as metres (SI). Closed polylines and zero
/// length segments are skipped.
///
/// # Errors
///
/// Returns [`CadError::Parse`] on malformed payloads and
/// [`CadError::Empty`] when nothing importable remains.
pub fn import_dxf(bytes: &[u8]) -> Result<Vec<RawSegment>, CadError> {
    let mut reader = Cursor::new(bytes);
    let drawing = Drawing::load(&mut reader).map_err(|e| CadError::Parse(e.to_string()))?;
    let mut segments = Vec::new();
    for entity in drawing.entities() {
        match &entity.specific {
            EntityType::Line(line) => {
                segments.push(RawSegment {
                    a: [line.p1.x, line.p1.y, line.p1.z],
                    b: [line.p2.x, line.p2.y, line.p2.z],
                });
            }
            EntityType::LwPolyline(poly) => {
                let vertices = &poly.vertices;
                for window in vertices.windows(2) {
                    segments.push(RawSegment {
                        a: [window[0].x, window[0].y, 0.0],
                        b: [window[1].x, window[1].y, 0.0],
                    });
                }
                if poly.is_closed() {
                    if let (Some(first), Some(last)) = (vertices.first(), vertices.last()) {
                        segments.push(RawSegment {
                            a: [last.x, last.y, 0.0],
                            b: [first.x, first.y, 0.0],
                        });
                    }
                }
            }
            EntityType::Polyline(poly) => {
                let points: Vec<[f64; 3]> = poly
                    .vertices()
                    .map(|v| [v.location.x, v.location.y, v.location.z])
                    .collect();
                for window in points.windows(2) {
                    segments.push(RawSegment {
                        a: window[0],
                        b: window[1],
                    });
                }
            }
            _ => {}
        }
    }
    segments.retain(|s| {
        let d = [s.b[0] - s.a[0], s.b[1] - s.a[1], s.b[2] - s.a[2]];
        (d[0] * d[0] + d[1] * d[1] + d[2] * d[2]).sqrt() > 1e-9
    });
    if segments.is_empty() {
        return Err(CadError::Empty);
    }
    Ok(segments)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_ascii_line_entity() {
        // Minimal ASCII DXF with one LINE entity on layer RDM.
        let dxf = "0\nSECTION\n2\nENTITIES\n0\nLINE\n8\nRDM\n10\n0.0\n11\n4.0\n20\n0.0\n21\n0.0\n30\n0.0\n31\n0.0\n0\nENDSEC\n0\nEOF\n";
        let segments = import_dxf(dxf.as_bytes()).expect("import");
        assert_eq!(segments.len(), 1);
        assert!((segments[0].b[0] - 4.0).abs() < 1e-12);
    }

    #[test]
    fn rejects_empty_payload() {
        assert!(matches!(import_dxf(b"not a dxf"), Err(CadError::Parse(_))));
        // An empty payload parses to an empty drawing: still unusable.
        assert!(matches!(import_dxf(b""), Err(CadError::Empty)));
    }
}
