Set Shell = CreateObject("WScript.Shell")
BasePath = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
Shell.Run "powershell -ExecutionPolicy RemoteSigned -File """ & BasePath & "\start-server.ps1""", 0, False
