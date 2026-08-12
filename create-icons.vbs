' ASCII-only VBS fallback: create desktop + taskbar shortcuts without PowerShell encoding issues.
Option Explicit
Dim fso, sh, root, desktop, startBat, updateBat, lnkBoard, lnkUpdate, lnkUpdateAscii
Dim deskBoard, deskUpdate, deskUpdateAscii, cmdExe, taskPin, startMenu, pinBoard, pinUpdate

Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")

root = fso.GetParentFolderName(WScript.ScriptFullName)
desktop = sh.SpecialFolders("Desktop")
cmdExe = sh.ExpandEnvironmentStrings("%SystemRoot%\System32\cmd.exe")
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

Call MakeLnkCmd(deskBoard, startBat, root, "%SystemRoot%\System32\imageres.dll,109")
On Error Resume Next
Call MakeLnkCmd(deskUpdate, updateBat, root, "%SystemRoot%\System32\imageres.dll,23")
If Err.Number <> 0 Then
  Err.Clear
  Call MakeLnkCmd(deskUpdateAscii, updateBat, root, "%SystemRoot%\System32\imageres.dll,23")
End If
On Error GoTo 0

' project folder copies
Call MakeLnkCmd(root & "\" & lnkBoard, startBat, root, "%SystemRoot%\System32\imageres.dll,109")
On Error Resume Next
Call MakeLnkCmd(root & "\" & lnkUpdate, updateBat, root, "%SystemRoot%\System32\imageres.dll,23")
If Err.Number <> 0 Then
  Err.Clear
  Call MakeLnkCmd(root & "\" & lnkUpdateAscii, updateBat, root, "%SystemRoot%\System32\imageres.dll,23")
End If
On Error GoTo 0

' Taskbar pin folder + Start Menu — BOTH board + update
taskPin = sh.ExpandEnvironmentStrings("%APPDATA%\Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar")
startMenu = sh.SpecialFolders("Programs") & "\AI_Program_Main_Board"
If Not fso.FolderExists(taskPin) Then fso.CreateFolder taskPin
If Not fso.FolderExists(startMenu) Then fso.CreateFolder startMenu

pinBoard = deskBoard
If Not fso.FileExists(pinBoard) Then pinBoard = root & "\" & lnkBoard
If fso.FileExists(deskUpdate) Then
  pinUpdate = deskUpdate
ElseIf fso.FileExists(deskUpdateAscii) Then
  pinUpdate = deskUpdateAscii
ElseIf fso.FileExists(root & "\" & lnkUpdate) Then
  pinUpdate = root & "\" & lnkUpdate
Else
  pinUpdate = root & "\" & lnkUpdateAscii
End If

On Error Resume Next
If fso.FileExists(pinBoard) Then
  fso.CopyFile pinBoard, taskPin & "\" & lnkBoard, True
  fso.CopyFile pinBoard, startMenu & "\" & lnkBoard, True
End If
If fso.FileExists(pinUpdate) Then
  fso.CopyFile pinUpdate, taskPin & "\" & fso.GetFileName(pinUpdate), True
  fso.CopyFile pinUpdate, startMenu & "\" & fso.GetFileName(pinUpdate), True
End If
On Error GoTo 0

WScript.Echo "[OK] Desktop + Taskbar icons created in:"
WScript.Echo "  " & desktop
WScript.Echo "  " & deskBoard
If fso.FileExists(deskUpdate) Then
  WScript.Echo "  " & deskUpdate
Else
  WScript.Echo "  " & deskUpdateAscii
End If
WScript.Echo "  TaskBar: " & taskPin
WScript.Quit 0

Sub MakeLnkCmd(path, batTarget, workdir, icon)
  Dim sc
  Set sc = sh.CreateShortcut(path)
  sc.TargetPath = cmdExe
  sc.Arguments = "/c """ & batTarget & """"
  sc.WorkingDirectory = workdir
  sc.WindowStyle = 1
  sc.IconLocation = icon
  sc.Save
End Sub
