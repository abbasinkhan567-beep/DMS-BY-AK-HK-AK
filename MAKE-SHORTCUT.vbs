Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
base = fso.GetParentFolderName(WScript.ScriptFullName)

Set sc = WshShell.CreateShortcut(WshShell.SpecialFolders("Desktop") & "\Pepsi Distribution.lnk")
sc.TargetPath = "powershell.exe"
sc.Arguments = "-WindowStyle Hidden -ExecutionPolicy RemoteSigned -File """ & base & "\start-server.ps1"""
sc.WorkingDirectory = base
sc.Description = "Pepsi Distribution Management System"
ico = base & "\public\icon.ico"
If fso.FileExists(ico) Then sc.IconLocation = ico
sc.Save

WScript.Echo "Shortcut created on desktop!"
