' ASCII-only VBS fallback: create desktop shortcuts without PowerShell encoding issues.
Option Explicit
Dim fso, sh, root, desktop, startBat, updateBat, lnkBoard, lnkUpdate, lnkUpdateAscii
Dim deskBoard, deskUpdate, deskUpdateAscii

Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")

root = fso.GetParentFolderName(WScript.ScriptFullName)
desktop = sh.SpecialFolders("Desktop")
startBat = root & "\start.bat"
If Not fso.FileExists(startBat) Then startBat = root & "\run.bat"
updateBat = root & "\update-version.bat"
If Not fso.FileExists(updateBat) Then
  WScript.Echo "[ERROR] update-version.bat missing in " & root
  WScript.Quit 1
End If
If Not fso.FileExists(startBat) Then
  WScript.Echo "[ERROR] start.bat / run.bat missing in " & root
  WScript.Quit 1
End If

lnkBoard = "AI_Program_Main_Board.lnk"
' Korean update shortcut name via ChrW codepoints
lnkUpdate = "AI_" & ChrW(&HBCF4) & ChrW(&HB4DC) & "_" & _
            ChrW(&HBC84) & ChrW(&HC804) & ChrW(&HAC31) & ChrW(&HC2E0) & ".lnk"
lnkUpdateAscii = "AI_Board_Update.lnk"

deskBoard = desktop & "\" & lnkBoard
deskUpdate = desktop & "\" & lnkUpdate
deskUpdateAscii = desktop & "\" & lnkUpdateAscii

Call MakeLnk(deskBoard, startBat, root, "%SystemRoot%\System32\imageres.dll,109")
On Error Resume Next
Call MakeLnk(deskUpdate, updateBat, root, "%SystemRoot%\System32\imageres.dll,23")
If Err.Number <> 0 Then
  Err.Clear
  Call MakeLnk(deskUpdateAscii, updateBat, root, "%SystemRoot%\System32\imageres.dll,23")
End If
On Error GoTo 0

' project folder copies
Call MakeLnk(root & "\" & lnkBoard, startBat, root, "%SystemRoot%\System32\imageres.dll,109")
On Error Resume Next
Call MakeLnk(root & "\" & lnkUpdate, updateBat, root, "%SystemRoot%\System32\imageres.dll,23")
If Err.Number <> 0 Then
  Err.Clear
  Call MakeLnk(root & "\" & lnkUpdateAscii, updateBat, root, "%SystemRoot%\System32\imageres.dll,23")
End If
On Error GoTo 0

WScript.Echo "[OK] Desktop icons created in:"
WScript.Echo "  " & desktop
WScript.Echo "  " & deskBoard
If fso.FileExists(deskUpdate) Then
  WScript.Echo "  " & deskUpdate
Else
  WScript.Echo "  " & deskUpdateAscii
End If
WScript.Quit 0

Sub MakeLnk(path, target, workdir, icon)
  Dim sc
  Set sc = sh.CreateShortcut(path)
  sc.TargetPath = target
  sc.WorkingDirectory = workdir
  sc.WindowStyle = 1
  sc.IconLocation = icon
  sc.Save
End Sub
