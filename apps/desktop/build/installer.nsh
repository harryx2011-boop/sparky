; Puts the `sparky` command (resources\cli\sparky.cmd) on the per-user PATH at install
; and takes exactly that entry off again at uninstall. Pure NSIS, no plugins.
; electron-builder compiles this file twice (installer, then uninstaller with
; BUILD_UNINSTALLER), and treats warnings as errors, so each pass only defines the
; functions it calls.

!include LogicLib.nsh
!include WinMessages.nsh

; Setup must stop every Sparky.exe under $INSTDIR, and that includes the CLI (`sparky mcp`, a job run
; from a terminal), which runs as Sparky.exe too. Stop the CLI first, with its own prompt, then hand
; over to electron-builder's check for the app itself. Defining this macro makes electron-builder
; skip the include and variable its default check needs, so they are declared here.
!include "getProcessInfo.nsh"
Var pid

!define SPARKY_CLI_PROCS "Get-CimInstance Win32_Process | ? { $$_.Name -eq 'Sparky.exe' -and $$_.Path -and $$_.Path.StartsWith('$INSTDIR', 'CurrentCultureIgnoreCase') -and $$_.CommandLine -match '[\\/]resources[\\/]cli[\\/]lib[\\/]sparky\.js' }"

!macro customCheckAppRunning
  !insertmacro IS_POWERSHELL_AVAILABLE
  ${If} $IsPowerShellAvailable == 0
    nsExec::Exec `"$PowerShellPath" -NoProfile -C "if (@(${SPARKY_CLI_PROCS}).Count -gt 0) { exit 0 } else { exit 1 }"`
    Pop $R0
    ${If} $R0 == 0
      MessageBox MB_OKCANCEL|MB_ICONINFORMATION "Sparky's command-line tools are running, for example as an agent's MCP server. Setup will close them, and the agent's client starts them again on its next call." /SD IDOK IDOK +2
      Quit
      DetailPrint "Closing Sparky's command-line tools."
      ; Ask first, give them three seconds, then force whatever is left. Without a window the polite
      ; request is usually refused, but a host with one exits cleanly.
      nsExec::Exec `"$PowerShellPath" -NoProfile -C "$$p = @(${SPARKY_CLI_PROCS}); $$p | % { taskkill.exe /PID $$_.ProcessId 2>&1 | Out-Null }; $$end = (Get-Date).AddSeconds(3); while ((Get-Date) -lt $$end -and @($$p | ? { Get-Process -Id $$_.ProcessId -EA 0 }).Count) { Start-Sleep -Milliseconds 250 }; $$p | % { Stop-Process -Id $$_.ProcessId -Force -EA 0 }"`
      Pop $R0
    ${EndIf}
  ${EndIf}
  !insertmacro _CHECK_APP_RUNNING
!macroend

!macro sparkyPathFunctions UN
  ; In: $R0 the entry. Out: $R1 the raw user Path (REG_EXPAND_SZ text, unexpanded),
  ; $R2 "1" when it is safe to rewrite: read in full, or absent.
  Function ${UN}sparkyReadUserPath
    StrCpy $R2 "1"
    ClearErrors
    ReadRegStr $R1 HKCU "Environment" "Path"
    ${If} ${Errors}
      StrCpy $R1 ""
      ; An error means the value is missing or too long for NSIS_MAX_STRLEN. Only a
      ; missing value may be written; a truncated one would wipe the user's PATH.
      StrCpy $R3 0
      ${Do}
        ClearErrors
        EnumRegValue $R4 HKCU "Environment" $R3
        ${If} ${Errors}
        ${OrIf} $R4 == ""
          ${Break}
        ${EndIf}
        ${If} $R4 == "Path"
          StrCpy $R2 "0"
          ${Break}
        ${EndIf}
        IntOp $R3 $R3 + 1
      ${Loop}
    ${EndIf}
  FunctionEnd

  ; In: $R0 the entry, $R1 the Path. Out: $R5 the Path without any segment equal to
  ; $R0 or "$R0\" (case-insensitive), every other segment kept as written, and $R6
  ; "1" when such a segment was found.
  Function ${UN}sparkyStripEntry
    StrCpy $R5 ""
    StrCpy $R6 "0"
    StrCpy $R7 ""
    StrCpy $R9 0
    StrCpy $R3 0
    StrLen $R4 $R1
    ${Do}
      ${If} $R3 >= $R4
        StrCpy $R8 ";"
      ${Else}
        StrCpy $R8 $R1 1 $R3
      ${EndIf}
      ${If} $R8 == ";"
        ${If} $R7 == $R0
        ${OrIf} $R7 == "$R0\"
          StrCpy $R6 "1"
        ${Else}
          ${If} $R9 > 0
            StrCpy $R5 "$R5;"
          ${EndIf}
          StrCpy $R5 "$R5$R7"
          IntOp $R9 $R9 + 1
        ${EndIf}
        StrCpy $R7 ""
        ${If} $R3 >= $R4
          ${Break}
        ${EndIf}
      ${Else}
        StrCpy $R7 "$R7$R8"
      ${EndIf}
      IntOp $R3 $R3 + 1
    ${Loop}
  FunctionEnd
!macroend

!macro sparkySaveRegisters
  Push $R0
  Push $R1
  Push $R2
  Push $R3
  Push $R4
  Push $R5
  Push $R6
  Push $R7
  Push $R8
  Push $R9
!macroend

!macro sparkyRestoreRegisters
  Pop $R9
  Pop $R8
  Pop $R7
  Pop $R6
  Pop $R5
  Pop $R4
  Pop $R3
  Pop $R2
  Pop $R1
  Pop $R0
!macroend

!ifndef BUILD_UNINSTALLER
  !insertmacro sparkyPathFunctions ""

  Function sparkyAddToPath
    !insertmacro sparkySaveRegisters
    StrCpy $R0 "$INSTDIR\resources\cli"
    Call sparkyReadUserPath
    ${If} $R2 != "1"
      DetailPrint "Sparky could not add itself to PATH. Add $R0 to PATH to use the sparky command."
    ${Else}
      Call sparkyStripEntry
      ${If} $R6 == "0"
        ${If} $R1 == ""
          StrCpy $R5 $R0
        ${Else}
          StrCpy $R8 $R1 1 -1
          ${If} $R8 == ";"
            StrCpy $R5 "$R1$R0"
          ${Else}
            StrCpy $R5 "$R1;$R0"
          ${EndIf}
        ${EndIf}
        StrLen $R3 $R5
        IntOp $R4 ${NSIS_MAX_STRLEN} - 1
        ${If} $R3 >= $R4
          DetailPrint "Sparky could not add itself to PATH. Add $R0 to PATH to use the sparky command."
        ${Else}
          WriteRegExpandStr HKCU "Environment" "Path" $R5
          SendMessage ${HWND_BROADCAST} ${WM_SETTINGCHANGE} 0 "STR:Environment" /TIMEOUT=5000
        ${EndIf}
      ${EndIf}
    ${EndIf}
    !insertmacro sparkyRestoreRegisters
  FunctionEnd

  !macro customInstall
    Call sparkyAddToPath
  !macroend
!else
  !insertmacro sparkyPathFunctions "un."

  ; Runs on every uninstall, including the silent one an update performs (always with
  ; --updated); the new installer's customInstall adds the entry back for its folder.
  Function un.sparkyRemoveFromPath
    !insertmacro sparkySaveRegisters
    StrCpy $R0 "$INSTDIR\resources\cli"
    Call un.sparkyReadUserPath
    ${If} $R2 == "1"
      Call un.sparkyStripEntry
      ${If} $R6 == "1"
        ${If} $R5 == ""
          DeleteRegValue HKCU "Environment" "Path"
        ${Else}
          WriteRegExpandStr HKCU "Environment" "Path" $R5
        ${EndIf}
        SendMessage ${HWND_BROADCAST} ${WM_SETTINGCHANGE} 0 "STR:Environment" /TIMEOUT=5000
      ${EndIf}
    ${EndIf}
    !insertmacro sparkyRestoreRegisters
  FunctionEnd

  !macro customUnInstall
    Call un.sparkyRemoveFromPath
  !macroend
!endif
