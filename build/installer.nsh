; NSIS custom include for Bipa
; - Adiciona um Section opcional "Iniciar Bipa com o Windows" que grava HKCU Run
;   (aparece na tela "Escolha os componentes" do instalador)
; - customUnInstall limpa o registry entry ao desinstalar

!macro customInstall
  ; nothing extra — electron-builder já cuida do resto
!macroend

!macro customUnInstall
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Bipa"
!macroend

; Seção opcional (/o = desmarcada por padrão) para iniciar com o Windows.
Section /o "Iniciar Bipa com o Windows" SEC_AUTOSTART
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Bipa" '"$INSTDIR\Bipa.exe"'
SectionEnd
