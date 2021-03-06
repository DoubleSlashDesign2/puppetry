import log from "electron-log";
import uniqid from "uniqid";
import { createActions } from "redux-actions";
import { validate, validatePlain } from "../service/validate";
import { writeSuite, readSuite, removeSuite,
  getProjectFiles, writeProject,
  readProject, removeRuntimeTestPath,
  isRuntimeTestPathReady,
  normalizeFilename } from "../service/io";
import { closeApp } from "service/utils";
import { InvalidArgumentError } from "error";
import DEFAULT_STATE from "reducer/defaultState";
import { ipcRenderer, remote } from "electron";
import { E_FILE_NAVIGATOR_UPDATED, E_WATCH_FILE_NAVIGATOR,
  E_PROJECT_LOADED, E_SUITE_LOADED, E_SUITE_LIST_UPDATED } from "constant";
import { getDateString, checkNewVersion } from "../service/http";
import debounce from "lodash.debounce";

const STORAGE_KEY_SETTINGS = "settings",

      version = remote ? remote.app.getVersion() : "0.1",

      actions = createActions({

        SET_SETTINGS: ( options ) => options,

        SET_ERROR: ( options ) => validate( "errorOptions", options ),

        /**
         * @param {object} options = { loading, newProjectModal, testReportModal, project }
         * @returns {object}
         */
        UPDATE_APP: ( options ) => validate( "updateAppOptions", options ),

        ADD_APP_TAB: ( tabKey ) => validatePlain( "appTabKey", tabKey ),

        REMOVE_APP_TAB: ( tabKey ) => validatePlain( "appTabKey", tabKey ),

        SET_APP_TAB: ( tabKey ) => tabKey,

        SET_PROJECT: ( options ) => options,

        SET_SUITE: ( options ) => validate( "updateSuiteOptions", options ),

        RESET_SUITE: ( options ) => validate( "updateSuiteOptions", options ),

        SWAP_TARGET: ( options ) => validate( "swapTargetOptions", options ),

        SWAP_COMMAND: ( options ) => validate( "swapCommandOptions", options ),

        SWAP_TEST: ( options ) => validate( "swapTestOptions", options ),

        SWAP_GROUP: ( options ) => validate( "swapGroupOptions", options ),

        /**
         * @param {object} options = { title, editing }
         * @returns {object}
         */
        UPDATE_SUITE: ( options ) => validate( "updateSuiteOptions", options ),

        CLEAR_TARGET: ( options ) => options,

        /**
         * @param {object} options = { target, selector, editing }
         * @param {object} [id] - injected id for new entity
         * @returns {object}
         */
        ADD_TARGET: ( options, id = null ) => ({
          options: validate( "addTargetOptions", options ),
          id
        }),
        /**
         * @param {object} options = { title, editing }
         * @param {object} position = { "after": ID }
         * @param {object} [id] - injected id for new entity
         * @returns {object}
         */
        INSERT_ADJACENT_TARGET: ( options, position, id = null ) => ({
          position,
          options,
          id
        }),
        /**
         * @param {object} options = { id, target, selector, editing }
         * @returns {object}
         */
        UPDATE_TARGET: ( options ) => validate( "updateTargetOptions", options ),
        /**
         * @param {object} options = { id }
         * @returns {object}
         */
        REMOVE_TARGET: ( options ) => validate( "removeOptions", options ),
        /**
         * @param {object} options = { title, editing }
         * @param {object} [id] - injected id for new entity
         * @returns {object}
         */
        ADD_GROUP: ( options, id = null ) => ({
          options: validate( "addGroupOptions", options ),
          id
        }),
        /**
         * @param {object} options = { title, editing }
         * @param {object} position = { "after": ID }
         * @param {object} [id] - injected id for new entity
         * @returns {object}
         */
        INSERT_ADJACENT_GROUP: ( options, position, id = null ) => ({
          position,
          options,
          id
        }),
        /**
         * @param {object} options = { id, title, editing }
         * @returns {object}
         */
        UPDATE_GROUP: ( options ) => validate( "updateGroupOptions", options ),
        /**
         * @param {object} options = { id }
         * @returns {object}
         */
        REMOVE_GROUP: ( options ) => validate( "removeOptions", options ),
        /**
         * @param {object} options = { groupId, title, editing }
         * @param {object} [id] - injected id for new entity
         * @returns {object}
         */
        ADD_TEST: ( options, id = null ) =>  ({
          options: validate( "addTestOptions", options ),
          id
        }),
        /**
         * @param {object} options = { title, editing }
         * @param {object} position = { "after": ID }
         * @param {object} [id] - injected id for new entity
         * @returns {object}
         */
        INSERT_ADJACENT_TEST: ( options, position, id = null ) => ({
          position,
          options,
          id
        }),
        /**
         * @param {object} options = { groupId, id, title, editing }
         * @returns {object}
         */
        UPDATE_TEST: ( options ) => validate( "updateTestOptions", options ),
        /**
         * @param {object} options = { groupId, id }
         * @returns {object}
         */
        REMOVE_TEST: ( options ) => validate( "removeTestOptions", options ),
        /**
         * @param {object} options = { testId, groupId, target, method, editing }
         * @returns {object}
         */
        ADD_COMMAND: ( options ) => validate( "addCommandOptions", options ),
        /**
         * @param {object} options = { title, editing }
         * @param {object} position = { "after": ID }
         * @returns {object}
         */
        INSERT_ADJACENT_COMMAND: ( options, position ) => ({
          position,
          options
        }),
        /**
         * @param {object} options = { testId, groupId, id, target, method, editing }
         * @returns {object}
         */
        UPDATE_COMMAND: ( options ) => validate( "updateCommandOptions", options ),
        /**
         * @param {object} options = { testId, groupId, id }
         * @returns {object}
         */
        REMOVE_COMMAND: ( options ) => validate( "removeCommandOptions", options )
      });

/**
 * Thunk actions
 */

// SETTINGS

actions.saveSettings = ( payload ) => ( dispatch, getState ) => {
  const settings = { ...getState().settings, ...payload };
  localStorage.setItem( STORAGE_KEY_SETTINGS, JSON.stringify( settings ) );
  dispatch( actions.setSettings( settings ) );
};

actions.loadSettings = () => ( dispatch, getState ) => {
  const saved = process.env.PUPPETRY_CLEAN_START
          ? {}
          : JSON.parse( localStorage.getItem( STORAGE_KEY_SETTINGS ) || "{}" ),
        settings = { ...getState().settings, ...saved };
  dispatch( actions.setSettings( settings ) );
  return settings;
};

// PROJECT

actions.loadProject = ( directory = null ) => async ( dispatch, getState ) => {
  const projectDirectory = directory || getState().settings.projectDirectory;
  let project;
  if ( !projectDirectory ) {
    throw new InvalidArgumentError( "Empty project directory" );
  }
  try {
    dispatch( actions.updateApp({ loading: true }) );
    project = await readProject( projectDirectory );
    ipcRenderer.send( E_PROJECT_LOADED, projectDirectory );
    directory && dispatch( actions.saveSettings({ projectDirectory }) );
    dispatch( actions.setProject( project ) );
    dispatch( actions.loadProjectFiles( projectDirectory ) );
    dispatch( actions.watchProjectFiles( projectDirectory ) );
    project.lastOpenSuite && dispatch( await actions.openSuiteFile( project.lastOpenSuite ) );
  } catch ( err ) {
    log.warn( `Renderer process: actions.loadProject(${projectDirectory }): ${ err }` );
  } finally {
    dispatch( actions.updateApp({ loading: false }) );
  }

  return project;
};

actions.watchProjectFiles = ( directory = null ) => async ( dispatch, getState ) => {
  const projectDirectory = directory || getState().settings.projectDirectory;
  // We have to subscribe every time, because it's bound to EVENt sent with ipcRenderer.send
  ipcRenderer.removeAllListeners( "E_FILE_NAVIGATOR_UPDATED" );
  ipcRenderer.on( E_FILE_NAVIGATOR_UPDATED, debounce( () => {
    dispatch( actions.loadProjectFiles( projectDirectory ) );
  }, 300 ) );
  ipcRenderer.send( E_WATCH_FILE_NAVIGATOR, projectDirectory );
};

actions.loadProjectFiles = ( directory = null ) => async ( dispatch, getState ) => {
  const store = getState(),
        projectDirectory = directory || store.settings.projectDirectory,
        files = await getProjectFiles( projectDirectory );
  ipcRenderer.send( E_SUITE_LIST_UPDATED, projectDirectory, store.suite.filename, files );
  dispatch( actions.updateApp({ project: { files }}) );
};

actions.saveProject = ({ projectDirectory, name }) => async ( dispatch, getState ) => {
  try {
    if ( !name ) {
      throw new InvalidArgumentError( "Empty suite name" );
    }
    if ( !projectDirectory ) {
      throw new InvalidArgumentError( "Empty project directory" );
    }

    await dispatch( actions.setProject({ projectDirectory, name }) );
    await saveProject( getState() );
    await dispatch( actions.loadProjectFiles( projectDirectory ) );
    await dispatch( actions.watchProjectFiles( projectDirectory ) );
    await dispatch( actions.removeAppTab( "suite" ) );

  } catch ( e ) {
    dispatch( actions.setError({
      visible: true,
      message: "Cannot save project",
      description: e.message
    }) );
  }
};

actions.removeSuite = ( filename ) => async ( dispatch, getState ) => {
  if ( !filename || typeof filename !== "string" ) {
    throw new InvalidArgumentError( "Filename is not a string or empty" );
  }
  const { projectDirectory } = getState().settings;
  removeSuite( projectDirectory, filename );
};

// SUITE

actions.createSuite = ( rawFilename, title ) => async ( dispatch, getState ) => {
  if ( !rawFilename || typeof rawFilename !== "string" ) {
    throw new InvalidArgumentError( "Filename is not a string or empty" );
  }
  if ( !title || typeof title !== "string" ) {
    throw new InvalidArgumentError( "Title is not a string or empty" );
  }
  const { projectDirectory } = getState().settings,
        filename = normalizeFilename( rawFilename ) + ".json",
        suite = { ...DEFAULT_STATE.suite, filename, title, savedAt: new Date() };
  try {
    if ( !projectDirectory ) {
      throw new InvalidArgumentError( "Empty project directory" );
    }
    await writeSuite( projectDirectory, filename, JSON.stringify( suite, null, "  " ) );
    dispatch( actions.openSuiteFile( filename ) );

  } catch ( e ) {
    dispatch( actions.setError({
      visible: true,
      message: "Internal Error",
      description: e.message
    }) );
  }
};

actions.loadSuite = ( filename ) => async ( dispatch, getState ) => {
  const store = getState(),
        { projectDirectory } = store.settings,
        suite = await readSuite( projectDirectory, filename );
  dispatch( actions.setProject({ lastOpenSuite: filename }) );
  dispatch( actions.resetSuite({ ...suite, loadedAt: new Date(), filename, modified: false }) );
  ipcRenderer.send( E_SUITE_LOADED, projectDirectory, filename, store.app.project.files );
  dispatch( actions.addAppTab( "suite" ) );
};

actions.saveSuite = ( options = {}) => async ( dispatch, getState ) => {
  const store = getState(),
        { projectDirectory } = store.settings,
        { filename } = { ...store.suite, ...options };
  try {
    if ( !filename ) {
      throw new InvalidArgumentError( "Empty suite filename" );
    }
    if ( !projectDirectory ) {
      throw new InvalidArgumentError( "Empty project directory" );
    }
    const data = { ...store.suite, puppetry: version };
    await writeSuite( projectDirectory, filename, JSON.stringify( data, null, "  " ) );

    await saveProject( store );

    dispatch( actions.updateSuite({ savedAt: new Date(), modified: false }) );
  } catch ( e ) {
    dispatch( actions.setError({
      visible: true,
      message: "Internal Error",
      description: e.message
    }) );
  }
};

actions.openSuiteFile = ( filename ) => ( dispatch ) => {
  dispatch( actions.updateApp({ loading: true }) );
  try {
    dispatch( actions.loadSuite( filename ) );
  } catch ( e ) {
    dispatch( actions.setError({
      visible: true,
      message: "Cannot open file",
      description: e.message
    }) );
    log.warn( `Renderer process: actions.openSuiteFile: ${ e }` );
  }
  dispatch( actions.updateApp({ loading: false }) );
};

// APP

actions.setLoadingFor = ( ms ) => async ( dispatch ) => {
  dispatch( actions.updateApp({ loading: true }) );
  setTimeout( () => {
    dispatch( actions.updateApp({ loading: false }) );
  }, ms );
};

actions.checkNewVersion = () => async ( dispatch, getState ) => {
  const { settings } = getState(),
        checkDate = getDateString();
  // Only once a day
  if ( settings.checkDate !== checkDate ) {
    await checkNewVersion( settings.lastCheckedVersion );
  }
  return dispatch( actions.saveSettings({ checkDate }) );
};

actions.closeApp = () => async ( dispatch, getState ) => {
  const store = getState();
  try {
    await saveProject( store );
  } catch ( e ) {
    noop( e );
  }
  closeApp();

};

// MISC

/**
 *
 * @returns {Function}
 */
actions.resetCommandFailures = () => async ( dispatch, getState ) => {
  const { groups } = getState().suite;
  Object.values( groups ).forEach( ( group ) => {
    Object.values( group.tests ).forEach( ( test ) => {
      const matches = Object.values( test.commands ).filter( command => Boolean( command.failure ) );
      matches.forEach( ({ id, testId, groupId }) => dispatch(
        actions.updateCommand({ id, testId, groupId, failure: "" })
      ) );
    });
  });
};

/**
 *
 * @param {Object} command
 * @param {Object} [options] - e.g. { testId: "", groupId: "" }
 * @returns {Function}
 */
actions.cloneCommand = ( command, options = {}) => async ( dispatch, getState ) => {
  const groups = getState().suite.groups,
        source = groups[ command.groupId ].tests[ command.testId ].commands[ command.id ],
        merged = { ...source, ...options },
        position = { after: command.id };
  dispatch( actions.insertAdjacentCommand( merged, position ) );
};

/**
 *
 * @param {Object} test
 * @param {Object} [options] - e.g. { groupId: "" }
 * @returns {Function}
 */
actions.cloneTest = ( test, options = {}) => async ( dispatch, getState ) => {
  const groups = getState().suite.groups,
        source = groups[ test.groupId ].tests[ test.id ],
        id = uniqid(),
        merged = { ...source, ...options },
        position = { after: test.id };
  dispatch( actions.insertAdjacentTest( merged, position, id ) );
  Object.values( source.commands ).forEach( command => {
    dispatch( actions.addCommand({ ...command, testId: id, groupId: merged.groupId }) );
  });
};

/**
 * @private meant to be used only by cloneGroup
 * @param {Object} test
 * @param {Object} [options] - e.g. { groupId: "" }
 * @returns {Function}
 */
actions.transferTest = ( test, options = {}) => async ( dispatch, getState ) => {
  const groups = getState().suite.groups,
        source = groups[ test.groupId ].tests[ test.id ],
        id = uniqid(),
        merged = { ...source, ...options };
  dispatch( actions.addTest( merged, id ) );
  Object.values( source.commands ).forEach( command => {
    dispatch( actions.addCommand({ ...command, testId: id, groupId: options.groupId }) );
  });
};

/**
 *
 * @param {Object} group
 * @returns {Function}
 */
actions.cloneGroup = ( group ) => async ( dispatch, getState ) => {
  const suite = getState().suite,
        source = suite.groups[ group.id ],
        id = uniqid(),
        merged = { ...source, id, key: id },
        position = { after: group.id };

  dispatch( actions.insertAdjacentGroup( merged, position, id ) );
  Object.values( source.tests ).forEach( test => {
    dispatch( actions.transferTest( test, { groupId: id }) );
  });
};

/**
 *
 * @param {Object} group
 * @returns {Function}
 */
actions.cloneTarget = ( target ) => async ( dispatch, getState ) => {
  const suite = getState().suite,
        source = suite.targets[ target.id ],
        id = uniqid(),
        merged = { ...source, id, key: id },
        position = { after: target.id };

  dispatch( actions.insertAdjacentTarget( merged, position, id ) );
};

actions.checkRuntimeTestDirReady = () => async ( dispatch ) => {
  const readyToRunTests = await isRuntimeTestPathReady();
  if ( !readyToRunTests ) {
    removeRuntimeTestPath();
  }
  return dispatch( actions.updateApp({ readyToRunTests }) );
};

async function saveProject( store ) {
  if ( !store.settings.projectDirectory ) {
    return;
  }
  await writeProject( store.settings.projectDirectory,  {
    ...store.project,
    puppetry: version,
    modified: false
  });
}

function noop() {

}

export default actions;