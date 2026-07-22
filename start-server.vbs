Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
base = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = base

' Log file
Set logFile = fso.CreateTextFile(base & "\data\server-log.txt", True)
logFile.WriteLine Now & " Starting..."

' Check Node
On Error Resume Next
Set exec = WshShell.Exec("node -v")
If Err.Number <> 0 Then
  logFile.WriteLine "Node.js not found"
  WshShell.Run "https://nodejs.org", 1, False
  WScript.Quit 1
End If
logFile.WriteLine "Node: " & exec.StdOut.ReadLine
On Error GoTo 0

' Install if needed
If Not fso.FolderExists(base & "\node_modules") Then
  logFile.WriteLine "Installing packages..."
  WshShell.Run "powershell -WindowStyle Hidden -Command ""& npm install""", 0, True
  logFile.WriteLine "Install done"
End If

' Build if needed
If Not fso.FileExists(base & "\.next\BUILD_ID") Then
  logFile.WriteLine "Building app..."
  WshShell.Run "powershell -WindowStyle Hidden -Command ""& npm run build""", 0, True
  logFile.WriteLine "Build done"
End If

' Kill old server
logFile.WriteLine "Killing old node processes..."
WshShell.Run "powershell -WindowStyle Hidden -Command ""& taskkill /f /im node.exe 2>nul""", 0, True
WScript.Sleep 2000

' Start server hidden
logFile.WriteLine "Starting server..."
WshShell.Run "powershell -WindowStyle Hidden -Command ""& npx next start -p 3000""", 0, False

' Wait for server to be ready (poll up to 60s)
logFile.WriteLine "Waiting for server..."
For i = 1 To 30
  WScript.Sleep 2000
  On Error Resume Next
  Set http = CreateObject("MSXML2.XMLHTTP")
  http.Open "GET", "http://localhost:3000/login", False
  http.Send ""
  If Err.Number = 0 And http.Status = 200 Then
    logFile.WriteLine "Server ready on try " & i
    Exit For
  End If
  On Error GoTo 0
Next

logFile.WriteLine "Opening browser..."
WshShell.Run "http://localhost:3000/login", 1, False
logFile.WriteLine "Done"
logFile.Close
