# Field Notes

A dependency-free collection of interactive mathematics and AI-evaluation
projects. The landing page links to two standalone browser tools:

- **Toric lattices** visualizes rank-two character lattices, their dual
  cocharacter lattices, fans, cones, singularities, and weighted projective
  planes.
- **Second Opinion** is a local-first workbench for measuring pro-narrator
  judgment bias in language models with sealed community outcomes.

## Run locally

From the repository root:

```sh
python3 -m http.server 8000
```

Then visit `http://localhost:8000/`. The tools have no build step and keep study
data in browser local storage.

## Project documentation

- [`toric-lattices/`](toric-lattices/) contains the lattice explorer.
- [`sycophancy-test/README.md`](sycophancy-test/README.md) documents the study
  protocol, data workflow, and model-access requirements for Second Opinion.

The Second Opinion pilot ships with six sanitized, balanced source narratives.
Its private curation notes and sealed outcomes must not be included in prompts
sent to the model.
