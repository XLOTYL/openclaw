# Mocks (model / parity shims)

This directory holds **LLM and transport mocks** used for QA lab and WhatsApp tests. It is tracked on development branches and **omitted from the `deployed` branch** (see `docs/project_status/canonical-branches.md` in the xlotyl repo for the org-wide playbook).

After merging `main` into `deployed`, run the strip step documented there so `mocks/` is not part of the deployment tree.
