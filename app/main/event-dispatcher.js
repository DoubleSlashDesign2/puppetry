const { ipcMain, dialog, remote, BrowserWindow } = require( "electron" ),
      { E_BROWSE_DIRECTORY, E_DIRECTORY_SELECTED, E_RUN_TESTS,
        E_TEST_REPORTED, E_WATCH_FILE_NAVIGATOR, E_BROWSE_FILE, E_FILE_SELECTED,
        E_INSTALL_RUNTIME_TEST, E_SHOW_CONFIRM_DIALOG, E_CONFIRM_DIALOG_VALUE,
        E_OPEN_RECORDER_WINDOW
      } = require( "../constant" ),
      watchFiles = require( "./file-watcher" ),
      { installRuntimeTest } = require( "./install-runtime-test" ),
      path = require( "path" ),
      url = require( "url" ),
      runTests = require( "./test-runner" );

let recorderWindow;

ipcMain.on( E_SHOW_CONFIRM_DIALOG, async ( event, runtimeTestDirectory ) => {
   const res = dialog.showMessageBox( {
        type: "warning",
        buttons: [ "Save", "Ignore" ],
        title: "Unsaved changes",
        message: "You have unsaved changes in the open suite"
    });
   event.sender.send( E_CONFIRM_DIALOG_VALUE, res );
});



ipcMain.on( E_BROWSE_DIRECTORY, ( event ) => {
  dialog.showOpenDialog({
    properties: [ "openDirectory", "createDirectory" ]
  }, ( directories ) => {
    event.sender.send( E_DIRECTORY_SELECTED, directories ? directories[ 0 ] : "" );
  });
});

ipcMain.on( E_INSTALL_RUNTIME_TEST, async ( event, runtimeTestDirectory ) => {
  try {
    installRuntimeTest( event, runtimeTestDirectory );
  } catch ( err ) {

  }
});


ipcMain.on( E_RUN_TESTS, async ( event, cwd, targetFiles ) => {
  try {
    event.returnValue = await runTests( cwd, targetFiles );
    console.log( "\n" );
  } catch ( err ) {
    event.returnValue = { results: `Error: ${ err.message }` };
  }
});


ipcMain.on( E_BROWSE_FILE, ( event, defaultPath ) => {
  dialog.showOpenDialog({
    defaultPath,
    properties: [ "openFile" ],
    filters: [
      { name: "Suites", extensions: [ "json" ] }
    ]
  }, ( files ) => {
    event.sender.send( E_FILE_SELECTED, files ? files[ 0 ] : "" );
  });
});

ipcMain.on( E_WATCH_FILE_NAVIGATOR, async ( event, projectDirectory ) => {
  watchFiles( event, projectDirectory );
});

ipcMain.on( E_OPEN_RECORDER_WINDOW, async ( event ) => {

  // Create the browser window.
  recorderWindow = new BrowserWindow({
    width: 1400,
    height: 820,
    minWidth: 960,
    minHeight: 540,
    frame: false,
    devTools: process.env.ELECTRON_ENV === "dev",
    title: "Puppetry Recorder"
  });

  // and load the index.html of the app.
  recorderWindow.loadURL( url.format({
    pathname: path.join( __dirname, "..", "recorder.html" ),
    protocol: "file:",
    slashes: true
  }) );

  recorderWindow.focus();

});