' Silently launches the dashboard with no console window flashing on screen.
Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")
projectDir = fso.GetParentFolderName(WScript.ScriptFullName)
shell.CurrentDirectory = projectDir
shell.Run """" & projectDir & "\Launch Dashboard.bat""", 0, False
