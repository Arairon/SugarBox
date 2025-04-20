@echo off

SET ROOT=%CD%
SET TARGET=%CD%\..\dist

CALL mkdir %TARGET%

cd .\popup
CALL pnpm i
CALL pnpm build

CALL xcopy /Y /I /s dist %TARGET%\popup
cd %ROOT%
CALL xcopy /Y /-I manifest-dist.json %TARGET%\manifest.json
CALL xcopy /Y /-I page.js %TARGET%\page.js
CALL xcopy /Y /-I proxy.js %TARGET%\proxy.js
CALL mkdir %TARGET%\icons
CALL xcopy /Y /-I /s icons\48.png %TARGET%\icons\48.png
CALL xcopy /Y /-I /s icons\96.png %TARGET%\icons\96.png
CALL xcopy /Y /-I /s icons\128.png %TARGET%\icons\128.png


echo "Done"