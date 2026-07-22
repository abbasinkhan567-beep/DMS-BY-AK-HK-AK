Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
base = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = base

' Check Node
On Error Resume Next
Set exec = WshShell.Exec("node -v")
If Err.Number <> 0 Then
  WshShell.Run "https://nodejs.org", 1, False
  WScript.Quit 1
End If
On Error GoTo 0

' Install if needed
If Not fso.FolderExists(base & "\node_modules") Then
  WshShell.Run "cmd /c npm install", 0, True
End If

' Build if needed
If Not fso.FileExists(base & "\.next\BUILD_ID") Then
  WshShell.Run "cmd /c npm run build", 0, True
End If

' Start server hidden
WshShell.Run "cmd /c npx next start -p 3000", 0, False

' Open browser
WScript.Sleep 5000
WshShell.Run "http://localhost:3000/login", 1, False
