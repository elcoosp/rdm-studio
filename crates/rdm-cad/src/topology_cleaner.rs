//! Topology cleaning (`topology_cleaner.rs`): merges coincident nodes
//! within tolerance `ε` and splits T/X intersections so every joint is a
//! real node — ready to become an `rdm-model::Structure`.

use std::collections::BTreeMap;

/// A cleaned node (metres).
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct TopologyNode {
    /// Node key (1-based, dense).
    pub id: u32,
    /// Coordinates (m).
    pub position: [f64; 3],
}

/// A cleaned member between two node keys.
#[derive(Debug, Clone, PartialEq)]
pub struct TopologyBeam {
    /// First node key.
    pub n1: u32,
    /// Second node key.
    pub n2: u32,
}

/// Cleaned wireframe topology.
#[derive(Debug, Clone, PartialEq, Default)]
pub struct Topology {
    /// Dense 1-based nodes.
    pub nodes: Vec<TopologyNode>,
    /// Members as node-key pairs.
    pub beams: Vec<TopologyBeam>,
}

/// Topology cleaning errors.
#[derive(Debug, Clone, PartialEq, thiserror::Error)]
pub enum TopologyError {
    /// No segments were supplied.
    #[error("no segments to clean")]
    Empty,
}

/// Merges coincident segment endpoints within `epsilon` metres and splits
/// T/X intersections (an endpoint of one member lying inside another).
///
/// Returns the dense node list and the split member list.
///
/// # Errors
///
/// Returns [`TopologyError::Empty`] when `segments` is empty.
pub fn clean_topology(
    segments: &[crate::RawSegment],
    epsilon: f64,
) -> Result<Topology, TopologyError> {
    if segments.is_empty() {
        return Err(TopologyError::Empty);
    }
    let eps2 = epsilon * epsilon;
    // 1) Merge endpoints: first segment endpoint at a position claims the key.
    let mut node_index: BTreeMap<[u64; 3], u32> = BTreeMap::new();
    let mut nodes: Vec<[f64; 3]> = Vec::new();
    let quantize = |p: [f64; 3]| -> [u64; 3] {
        [
            (p[0] / epsilon).round() as i64 as u64,
            (p[1] / epsilon).round() as i64 as u64,
            (p[2] / epsilon).round() as i64 as u64,
        ]
    };
    let node_of =
        |p: [f64; 3], nodes: &mut Vec<[f64; 3]>, index: &mut BTreeMap<[u64; 3], u32>| -> u32 {
            let key = quantize(p);
            if let Some(&existing) = index.get(&key) {
                return existing;
            }
            // Neighbour cells within ε (rounding boundary).
            for dx in -1..=1 {
                for dy in -1..=1 {
                    for dz in -1..=1 {
                        let probe = [
                            (key[0] as i64 + dx) as u64,
                            (key[1] as i64 + dy) as u64,
                            (key[2] as i64 + dz) as u64,
                        ];
                        if let Some(&existing) = index.get(&probe) {
                            let q = nodes[existing as usize - 1];
                            let d = [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
                            if d[0] * d[0] + d[1] * d[1] + d[2] * d[2] <= eps2 {
                                return existing;
                            }
                        }
                    }
                }
            }
            nodes.push(p);
            let id = nodes.len() as u32;
            index.insert(key, id);
            id
        };

    let mut beams: Vec<(u32, u32)> = Vec::new();
    let mut endpoints: Vec<([f64; 3], u32)> = Vec::new();
    for segment in segments {
        let id_a = node_of(segment.a, &mut nodes, &mut node_index);
        let id_b = node_of(segment.b, &mut nodes, &mut node_index);
        if id_a != id_b {
            beams.push((id_a, id_b));
            endpoints.push((segment.a, id_a));
            endpoints.push((segment.b, id_b));
        }
    }

    // 2) T/X split: any endpoint lying strictly inside another member
    //    splits that member at the projection point.
    let mut split: Vec<(u32, u32)> = Vec::new();
    for &(a, b) in &beams {
        let pa = nodes[a as usize - 1];
        let pb = nodes[b as usize - 1];
        let ab = [pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]];
        let len2 = ab[0] * ab[0] + ab[1] * ab[1] + ab[2] * ab[2];
        if len2 < 1e-18 {
            continue;
        }
        let mut cuts: Vec<f64> = Vec::new();
        for &(point, node) in &endpoints {
            if node == a || node == b {
                continue;
            }
            let ap = [point[0] - pa[0], point[1] - pa[1], point[2] - pa[2]];
            let t = (ap[0] * ab[0] + ap[1] * ab[1] + ap[2] * ab[2]) / len2;
            if !(1e-9..1.0 - 1e-9).contains(&t) {
                continue;
            }
            let foot = [pa[0] + t * ab[0], pa[1] + t * ab[1], pa[2] + t * ab[2]];
            let d = [point[0] - foot[0], point[1] - foot[1], point[2] - foot[2]];
            if d[0] * d[0] + d[1] * d[1] + d[2] * d[2] <= eps2 {
                cuts.push(t);
            }
        }
        if cuts.is_empty() {
            split.push((a, b));
            continue;
        }
        cuts.sort_by(|x, y| x.partial_cmp(y).unwrap_or(std::cmp::Ordering::Equal));
        let mut previous = (pa, a);
        for &t in &cuts {
            let point = [pa[0] + t * ab[0], pa[1] + t * ab[1], pa[2] + t * ab[2]];
            let id = node_of(point, &mut nodes, &mut node_index);
            let (_, previous_id) = previous;
            if previous_id != id {
                split.push((previous_id, id));
            }
            previous = (point, id);
        }
        if previous.1 != b {
            split.push((previous.1, b));
        }
    }

    // Dense renumber (some keys may be unused after splits).
    let mut remap: BTreeMap<u32, u32> = BTreeMap::new();
    for id in split.iter().flat_map(|&(a, b)| [a, b]) {
        let next = remap.len() as u32 + 1;
        remap.entry(id).or_insert(next);
    }
    let out_nodes: Vec<TopologyNode> = remap
        .iter()
        .map(|(&old, &new)| TopologyNode {
            id: new,
            position: nodes[old as usize - 1],
        })
        .collect();
    let out_beams: Vec<TopologyBeam> = split
        .iter()
        .map(|&(a, b)| TopologyBeam {
            n1: remap[&a],
            n2: remap[&b],
        })
        .collect();
    Ok(Topology {
        nodes: out_nodes,
        beams: out_beams,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::RawSegment;

    #[test]
    fn merges_coincident_nodes() {
        let segments = vec![
            RawSegment {
                a: [0.0, 0.0, 0.0],
                b: [4.0, 0.0, 0.0],
            },
            RawSegment {
                a: [4.0, 0.000_000_5, 0.0],
                b: [8.0, 0.0, 0.0],
            },
        ];
        let topology = clean_topology(&segments, 1e-4).expect("clean");
        assert_eq!(topology.nodes.len(), 3);
        assert_eq!(topology.beams.len(), 2);
        assert_eq!(topology.beams[0].n2, topology.beams[1].n1);
    }

    #[test]
    fn splits_t_intersection() {
        let segments = vec![
            RawSegment {
                a: [0.0, 0.0, 0.0],
                b: [4.0, 0.0, 0.0],
            },
            RawSegment {
                a: [2.0, 0.0, -3.0],
                b: [2.0, 0.0, 0.0],
            },
        ];
        let topology = clean_topology(&segments, 1e-6).expect("clean");
        // The vertical member's tip lands mid-span: 3 members, 4 nodes.
        assert_eq!(topology.beams.len(), 3, "beams: {:?}", topology.beams);
        assert_eq!(topology.nodes.len(), 4);
    }

    #[test]
    fn rejects_empty_input() {
        assert!(matches!(
            clean_topology(&[], 1e-6),
            Err(TopologyError::Empty)
        ));
    }
}
