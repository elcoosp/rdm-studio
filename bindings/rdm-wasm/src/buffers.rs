//! Zero-copy `Float64Array` views over WASM linear memory for Three.js and
//! uPlot (ARCHITECTURE.md §5, `buffers.rs`).
//!
//! The solve results live in WASM linear memory; the web worker reads them
//! through [`js_sys::Float64Array::view`] without any serialization or copy
//! (the "zero-copy" edge of the §4 pipeline). When the UI needs the data on
//! the main thread, the worker copies into a transferable `ArrayBuffer`.

/// Marker trait for flat `f64` stores that can be viewed as typed arrays.
pub trait Float64View {
    /// Backing slice in WASM linear memory.
    fn as_slice(&self) -> &[f64];

    /// Zero-copy typed-array view over the backing slice.
    ///
    /// # Safety
    ///
    /// The returned `Float64Array` aliases WASM linear memory; it stays
    /// valid only while this object is alive and not mutated.
    ///
    /// # Panics
    ///
    /// Panics when the slice is empty (a zero-length view is meaningless).
    fn view(&self) -> js_sys::Float64Array {
        let slice = self.as_slice();
        assert!(
            !slice.is_empty(),
            "cannot build a zero-copy view of an empty buffer"
        );
        // SAFETY: the aliasing rules are documented on this method; the
        // caller keeps the owner alive for the lifetime of the view.
        unsafe { js_sys::Float64Array::view(slice) }
    }
}

impl Float64View for Vec<f64> {
    fn as_slice(&self) -> &[f64] {
        self.as_slice()
    }
}

// Typed-array views only exist under WASM; the host build just checks types.
#[cfg(all(test, target_arch = "wasm32"))]
mod tests {
    use super::*;

    #[test]
    fn view_covers_the_whole_buffer() {
        let data = vec![1.0, 2.0, 3.0];
        let array = data.view();
        assert_eq!(array.length() as usize, 3);
    }

    #[test]
    #[should_panic(expected = "empty buffer")]
    fn empty_buffer_panics() {
        let data: Vec<f64> = Vec::new();
        let _ = data.view();
    }
}
