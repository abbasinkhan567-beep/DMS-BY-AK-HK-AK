Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
base = fso.GetParentFolderName(WScript.ScriptFullName)

setupDone = fso.FileExists(base & "\.setup-done")

If setupDone Then
  args = "-WindowStyle Hidden -ExecutionPolicy RemoteSigned -File """ & base & "\start-server.ps1"""
Else
  args = "-WindowStyle Normal -ExecutionPolicy RemoteSigned -File """ & base & "\start-server.ps1"" -Setup"
End If

Set sc = WshShell.CreateShortcut(WshShell.SpecialFolders("Desktop") & "\Pepsi Distribution.lnk")
sc.TargetPath = "powershell.exe"
sc.Arguments = args
sc.WorkingDirectory = base
sc.Description = "Pepsi Distribution Management System"
ico = base & "\public\icon.ico"
If fso.FileExists(ico) Then sc.IconLocation = ico
sc.Save

WScript.Echo "Shortcut created! " & args
