; NSIS custom include para o Bipa.
; Adiciona um checkbox opcional na página final do INSTALADOR:
;    [ ] Iniciar o Bipa automaticamente com o Windows
; Marcando, escreve HKCU\Software\Microsoft\Windows\CurrentVersion\Run.
;
; Nota: o electron-builder roda o NSIS duas vezes (uma para gerar o uninstaller,
; outra para o installer). Precisamos gatear com !ifndef BUILD_UNINSTALLER
; para os defines/Function não vazarem no uninstaller (que usaria com "un.").

!ifndef BUILD_UNINSTALLER
  !define MUI_FINISHPAGE_SHOWREADME
  !define MUI_FINISHPAGE_SHOWREADME_TEXT "Iniciar o Bipa automaticamente com o Windows"
  !define MUI_FINISHPAGE_SHOWREADME_FUNCTION "EnableBipaAutoStart"
  !define MUI_FINISHPAGE_SHOWREADME_NOTCHECKED

  Function EnableBipaAutoStart
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Bipa" '"$INSTDIR\Bipa.exe"'
  FunctionEnd
!endif

!macro customInit
!macroend

!macro customInstall
!macroend

!macro customUnInstall
  ; Limpa o auto-start ao desinstalar
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Bipa"
!macroend
