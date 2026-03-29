/**
 * CLI-native generic risk list shown to the developer whenever a scripted asset
 * is installed or updated.  This is always displayed first, before any
 * author-supplied SCRIPT_RISKS.md content.
 */
export const GENERIC_SCRIPT_RISKS = `⚠️  This asset includes lifecycle scripts (postInstall / postUninstall).

Scripts are NEVER executed automatically by ai-stash.
You must run them manually. However, you should be aware that:

  • Scripts can execute arbitrary code with your user permissions
  • Scripts can install software, modify system files, or make network requests
  • Scripts can create files or configuration outside the asset folder
  • ai-stash does not sandbox, analyse, or validate script contents
  • ai-stash cannot guarantee rollback if a script partially fails
  • Cross-platform compatibility is the author's responsibility

Always read the scripts before running them.`;

/**
 * Build the full disclaimer text block for a scripted asset.
 * Used by both headless (CLI) callers and the TUI ScriptRiskDisclaimer component.
 */
export function buildScriptDisclaimerText(
  assetName: string,
  scriptNames: string[],
  scriptRisksContent: string | undefined,
  hasDeclaredScriptRisks = false,
  hasPostInstall: boolean,
  hasPostUninstall: boolean,
  scriptChanged = false,
): string {
  const lines: string[] = [];

  if (scriptChanged) {
    lines.push('─'.repeat(60));
    lines.push('⚠️  Script changed since last install — please re-review');
    lines.push('─'.repeat(60));
    lines.push('');
  }

  lines.push(GENERIC_SCRIPT_RISKS);
  lines.push('');
  lines.push('─'.repeat(60));

  if (hasDeclaredScriptRisks) {
    if (scriptRisksContent !== undefined) {
      lines.push(`Author's Risk Documentation — ${assetName}`);
      lines.push('─'.repeat(60));
      lines.push(scriptRisksContent.trim());
    } else {
      lines.push(`Author's Risk Documentation — ${assetName}`);
      lines.push('─'.repeat(60));
      lines.push('Author risk documentation unavailable.');
    }
    lines.push('');
    lines.push('─'.repeat(60));
  }

  lines.push('');
  lines.push('─'.repeat(60));
  lines.push(`Declared scripts for ${assetName}:`);
  for (const name of scriptNames) {
    lines.push(`  • ${name}`);
  }

  if (hasPostInstall && !hasPostUninstall) {
    lines.push('');
    lines.push('⚠️  No cleanup script (postUninstall) is declared.');
    lines.push('   Script side effects cannot be cleaned up automatically.');
    lines.push('   Check the author docs above for manual cleanup instructions.');
  }

  lines.push('─'.repeat(60));
  return lines.join('\n');
}
