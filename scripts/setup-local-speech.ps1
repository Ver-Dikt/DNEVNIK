$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$runtime = Join-Path $projectRoot '.maintenance\speech-runtime'
$venv = Join-Path $runtime 'venv'
$python = Join-Path $venv 'Scripts\python.exe'
if (-not (Test-Path -LiteralPath $python)) {
  & python -m venv $venv
  if ($LASTEXITCODE -ne 0) { throw 'Python 3.11+ is required for local speech setup.' }
}
& $python -m pip install --disable-pip-version-check -r (Join-Path $PSScriptRoot 'requirements-local-speech.txt')
if ($LASTEXITCODE -ne 0) { throw 'Speech dependencies could not be installed.' }
$env:HF_HUB_DISABLE_IMPLICIT_TOKEN = '1'
$env:HF_HUB_DISABLE_XET = '1'
& $python -c "from huggingface_hub import snapshot_download; import sys; snapshot_download('Systran/faster-whisper-base', local_dir=sys.argv[1], allow_patterns=['config.json','model.bin','tokenizer.json','vocabulary.*','preprocessor_config.json'], token=False)" (Join-Path $runtime 'model')
if ($LASTEXITCODE -ne 0) { throw 'Speech model could not be downloaded.' }
Write-Output 'Local speech recognition is ready. Audio is processed on this computer.'
