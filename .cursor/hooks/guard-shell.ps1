#Requires -Version 5
# beforeShellExecution guard: delegates the policy decision to
# .claude/hooks/block-dangerous-git.sh (exit 2 == block) and translates it into
# the JSON permission response Cursor expects. Fails closed on any doubt.

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$policyScript = Join-Path $repoRoot '.claude\hooks\block-dangerous-git.sh'
$logFile = Join-Path $PSScriptRoot 'guard-shell.log'
$bashCandidates = @(
    'C:\Program Files\Git\bin\bash.exe',
    'C:\Program Files (x86)\Git\bin\bash.exe'
)

function Write-Decision {
    param([string]$Permission, [string]$Message, [int]$ExitCode)

    $response = [ordered]@{ permission = $Permission }
    if ($Message) {
        $response.user_message = $Message
        $response.agent_message = $Message
    }
    Write-Output ($response | ConvertTo-Json -Compress)
    exit $ExitCode
}

function Write-Log {
    param([string]$Text)
    try {
        Add-Content -Path $logFile -Value "[$(Get-Date -Format o)] $Text" -Encoding utf8
    } catch {
        # Logging must never change the decision.
    }
}

$rawInput = [Console]::In.ReadToEnd()
Write-Log "stdin=$($rawInput -replace '\s+', ' ')"

# Cursor sends the payload with a UTF-8 BOM, which ConvertFrom-Json rejects.
$firstBrace = $rawInput.IndexOf('{')
if ($firstBrace -gt 0) { $rawInput = $rawInput.Substring($firstBrace) }

if ([string]::IsNullOrWhiteSpace($rawInput)) {
    Write-Log 'decision=deny reason=empty-stdin'
    Write-Decision -Permission 'deny' -Message 'Git guardrail received no hook input, so the command was blocked.' -ExitCode 2
}

try {
    $payload = $rawInput | ConvertFrom-Json
} catch {
    Write-Log 'decision=deny reason=unparseable-stdin'
    Write-Decision -Permission 'deny' -Message 'Git guardrail could not parse the hook input, so the command was blocked.' -ExitCode 2
}

$command = $payload.command
if (-not $command -and $payload.tool_input) { $command = $payload.tool_input.command }

if ([string]::IsNullOrWhiteSpace($command)) {
    Write-Log 'decision=allow reason=no-command-in-payload'
    Write-Decision -Permission 'allow' -Message $null -ExitCode 0
}

$bash = $bashCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $bash -or -not (Test-Path $policyScript)) {
    Write-Log "decision=deny reason=missing-policy-runtime bash=$bash script=$policyScript"
    Write-Decision -Permission 'deny' -Message 'Git guardrail could not run its policy script, so the command was blocked.' -ExitCode 2
}

$policyPayload = @{ tool_input = @{ command = $command } } | ConvertTo-Json -Compress

try {
    $startInfo = New-Object System.Diagnostics.ProcessStartInfo
    $startInfo.FileName = $bash
    $startInfo.Arguments = '"' + ($policyScript -replace '\\', '/') + '"'
    $startInfo.WorkingDirectory = $repoRoot
    $startInfo.UseShellExecute = $false
    $startInfo.RedirectStandardInput = $true
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true

    $policyProcess = [System.Diagnostics.Process]::Start($startInfo)
    $policyProcess.StandardInput.Write($policyPayload)
    $policyProcess.StandardInput.Close()
    $policyStderr = $policyProcess.StandardError.ReadToEnd()
    $policyProcess.StandardOutput.ReadToEnd() | Out-Null
    $policyProcess.WaitForExit()
    $policyExit = $policyProcess.ExitCode
} catch {
    Write-Log "decision=deny reason=policy-launch-failed detail=$($_.Exception.Message)"
    Write-Decision -Permission 'deny' -Message 'Git guardrail failed to launch its policy script, so the command was blocked.' -ExitCode 2
}

Write-Log "command=$command policy_exit=$policyExit policy_stderr=$($policyStderr -replace '\s+', ' ')"

if ($policyExit -eq 2) {
    $reason = if ($policyStderr) { $policyStderr.Trim() } else { "Blocked by git guardrail: $command" }
    Write-Decision -Permission 'deny' -Message $reason -ExitCode 2
}

if ($policyExit -ne 0) {
    Write-Decision -Permission 'deny' -Message "Git guardrail exited unexpectedly (code $policyExit), so the command was blocked." -ExitCode 2
}

Write-Decision -Permission 'allow' -Message $null -ExitCode 0
