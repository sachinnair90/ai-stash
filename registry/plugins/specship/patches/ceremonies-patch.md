# specship:spec-gate
# This block was appended by the specship plugin post-install script.
# To remove: run the specship postUninstall script, or delete everything
# between the specship:spec-gate and /specship:spec-gate sentinels.

- name: spec-gate
  when: before
  condition: >
    Any request that introduces a new feature, new capability, or new user-facing behaviour.
    Signals: "build X", "add X", "implement X", "create X", "new feature", "I want X to do Y".
    NOT triggered by: bug fixes, refactors, chores, dependency updates, documentation-only changes,
    or requests for features that already have an approved spec in openspec/changes/.
  facilitator: "{Speccer cast name}"
  mode: sync
  description: >
    Ensures a spec exists and is approved before implementation begins.
    The Speccer assesses idea clarity, optionally runs OpenSpec explore mode,
    produces proposal.md / design.md / specs/ / tasks.md, and gates on human approval.
    On approval, passes feature name and tasks.md path to the Coordinator.

  flow:
    - step: check_existing_spec
      action: >
        Check whether openspec/changes/{feature-name}/ already exists and contains tasks.md.
        If yes, skip to completion — the spec is already approved.
      on_skip: complete

    - step: invoke_speccer
      action: >
        Spawn the Speccer (sync). Pass the user's feature description and TEAM_ROOT.
        The Speccer runs its clarity assessment internally:
          - Clear idea → produces spec artifacts directly
          - Vague idea → enters OpenSpec explore mode, loops until developer types /propose
        The Speccer writes: proposal.md, design.md, specs/, tasks.md
      agent: "{Speccer cast name}"
      agent_mode: sync

    - step: human_gate
      action: >
        Present a summary of proposal.md to the developer:
          - Why (1-2 sentences)
          - What changes (bullet list)
          - Task count from tasks.md
        Ask: "Approve this spec and start implementation?"
        Options: ["Yes, proceed", "Request changes", "Cancel"]
      on_changes_requested: return_to_invoke_speccer
      on_cancel: abort

    - step: complete
      output:
        feature_name: "{derived from change directory name}"
        tasks_file: "openspec/changes/{feature-name}/tasks.md"
        specs_dir: "openspec/changes/{feature-name}/specs/"
        inject_into_spawns: >
          INPUT ARTIFACTS: openspec/changes/{feature-name}/specs/ (acceptance criteria — read before implementing)
          Relevant skill: .squad/skills/openspec/SKILL.md — read before starting

# /specship:spec-gate
