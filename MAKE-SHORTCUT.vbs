Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
base = fso.GetParentFolderName(WScript.ScriptFullName)

Set sc = WshShell.CreateShortcut(WshShell.SpecialFolders("Desktop") & "\Pepsi Distribution.lnk")
sc.TargetPath = "wscript.exe"
sc.Arguments = """" & base & "\start-server.vbs"""
sc.WorkingDirectory = base
sc.Description = "Pepsi Distribution Management System"
ico = base & "\public\icon.ico"
If fso.FileExists(ico) Then sc.IconLocation = ico
sc.Save

WScript.Echo "Shortcut created on desktop!"
