/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 * 
 * The contents of this file are subject to the Mozilla Public License
 * Version 1.1 (the "License"); you may not use this file except in
 * compliance with the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 * 
 * Software distributed under the License is distributed on an "AS IS"
 * basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. See the
 * License for the specific language governing rights and limitations
 * under the License.
 * 
 * The Original Code is Komodo code.
 * 
 * The Initial Developer of the Original Code is ActiveState Software Inc.
 * Portions created by ActiveState Software Inc are Copyright (C) 2000-2007
 * ActiveState Software Inc. All Rights Reserved.
 * 
 * Contributor(s):
 *   ActiveState Software Inc
 * 
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 * 
 * ***** END LICENSE BLOCK ***** */

if (typeof(ko)=='undefined') {
    var ko = {};
}
if (typeof(ko.projects)=='undefined') {
    ko.projects = {};
}

(function() {

function peMacro() {
    this.name = 'peMacro';
    this.log = ko.logging.getLogger('peMacro');
    //this.log.setLevel(ko.logging.LOG_DEBUG);
}

// The following two lines ensure proper inheritance (see Flanagan, p. 144).
peMacro.prototype.constructor = peMacro;

peMacro.prototype.init = function() {
}

peMacro.prototype.registerCommands = function() {
    ko.projects.extensionManager.registerCommand('cmd_executeMacro', this);
    ko.projects.extensionManager.registerCommand('cmd_openMacroPart', this);
}

peMacro.prototype.registerEventHandlers = function() {
    ko.projects.extensionManager.addEventHandler(Components.interfaces.koIPart_macro,
                                     'ondblclick', this);
}

peMacro.prototype.registerMenus = function() {
    ko.projects.extensionManager.createMenuItem(Components.interfaces.koIPart_macro,
                                    'Execute Macro',
                                    'cmd_executeMacro',
                                    null,
                                    null,
                                    true);
    ko.projects.extensionManager.createMenuItem(Components.interfaces.koIPart_macro,
                                    'Edit Macro','cmd_openMacroPart',
                                    null,
                                    null,
                                    false);
}

peMacro.prototype.ondblclick = function(item,event) {
    if (item.type != 'macro') return;
    ko.projects.executeMacro(item);
}

peMacro.prototype.supportsCommand = function(command, item) {
    if (ko.projects.active == null) return false;
    var items = ko.projects.active.getSelectedItems();
    var i;
    switch (command) {
    case 'cmd_executeMacro':
        if (items.length == 1 && items[0]
            && items[0].type == 'macro') {
            return true;
        } else {
            return false;
        }
        break;
    case 'cmd_openMacroPart':
        for (i = 0; i < items.length; i++) {
            if (items[i].type == 'macro') return true;
        }
        return false;
    default:
        break;
    }
    return false;
}

peMacro.prototype.isCommandEnabled = peMacro.prototype.supportsCommand;

peMacro.prototype.doCommand = function(command) {
    var cmd = null;
    var item = null;
    switch (command) {
    case 'cmd_openMacroPart':
        // get the current selection, then open the file
        if (ko.projects.active == null) return;
        var items = ko.projects.active.getSelectedItems();
        if (!items) return;
        var paths = [];
        var i;
        for (i = 0; i < items.length; i++) {
            if (items[i].type == 'macro') paths.push(items[i].url);
        }
        ko.open.multipleURIs(paths);
        break;
    case 'cmd_executeMacro':
        item = ko.projects.active.getSelectedItem();
        ko.projects.executeMacro(item);
        break;
    default:
        break;
    }
}

// this is hidden away now, no namespce, the registration keeps the reference
// we need
ko.projects.registerExtension(new peMacro());
}).apply();



(function() { // ko.projects
var log = ko.logging.getLogger('ko.projects');

 this.addMacro = function peMacro_addMacro(/*koIPart|koITool*/ parent,
                                           /*koIPart|koITool*/ part )
{
    if (typeof(part) == "undefined") {
        part = parent.project.createPartFromType('macro');
    }
    part.setStringAttribute('name', 'New Macro');
    var obj = new Object();
    obj.item = part;
    obj.parent = parent;
    obj.task = 'new';
    ko.windowManager.openOrFocusDialog(
        "chrome://komodo/content/project/macroProperties.xul",
        "komodo_macroProperties",
        "chrome,centerscreen,close=yes,dependent=no,resizable=yes", obj);
}

this.executeMacro = function macro_executeMacro(part, async, observer_arguments)
{
    log.info("executeMacro part.id:"+part.id);
    if (ko.macros.recorder.mode == 'recording') {
        // See bug 79081 for why we can't have async macros while recording.
        async = false;
    }
    try {
        ko.macros.recordPartInvocation(part);
        var language = part.getStringAttribute('language').toLowerCase();
        if (typeof(async) == "undefined")
            async = part.getBooleanAttribute('async');
        if (async
            && (language == 'javascript'
                || typeof(observer_arguments) != "undefined")) {
            // Python notification observers use this technique.
            setTimeout(_executeMacro, 10,
                       part, false, observer_arguments);
        } else {
            return _executeMacro(part, async, observer_arguments);
        }
    } catch (e) {
        log.exception(e);
    }
    return false;
}


this.executeMacroById = function macro_executeMacroById(id, asynchronous) {
    try {
        var _partSvc = Components.classes["@activestate.com/koPartService;1"]
                .getService(Components.interfaces.koIPartService);
        var macroPart = _partSvc.getPartById(id);
        var retval = _executeMacro(macroPart,
                                   (asynchronous
                                    && ko.macros.recorder.mode != 'recording'));
        return retval;
    } catch (e) {
        log.exception(e);
    }
    return false;
}

function _executeMacro(part, asynchronous, observer_arguments) {
    // Returns true if there was a problem running the macro
    // The synchronous flag is not used for JavaScript, since the timeout
    // has already occurred by the time we get called here.  JS execution
    // isn't in another thread, just on a timeout.
    if (typeof(observer_arguments) == "undefined") {
        observer_arguments = null;
    }
    try {
        ko.macros.recorder.suspendRecording();
        var language = part.getStringAttribute('language').toLowerCase();
        var retval = false;
        var exception = null;
        var view = null;
        
        if (observer_arguments
            && observer_arguments.subject
            && observer_arguments.subject.nodeName
            && observer_arguments.subject.nodeName == 'view') {
            view = observer_arguments.subject;
        }
        if (!view) {
            try {
                view = ko.views.manager.currentView;
            } catch(ex) {}
        }
        
        var editor = null;
        if (view && view.getAttribute('type') == 'editor' && view.scintilla && view.scintilla.scimoz) {
            editor = view.scintilla.scimoz;
        }
        switch (language) {
            case 'javascript':
                try {
                    retval = ko.macros.evalAsJavaScript(part.value, part,
                                                        observer_arguments, view);
                } catch (e) {
                    exception = String(e);
                }
                break;
            case 'python':
                try {
                    var koDoc = null;
                    if (view && view.koDoc) {
                        koDoc = view.koDoc;
                    }
                    editor = null;
                    if (view && view.getAttribute('type') == 'editor' && view.scimoz) {
                        editor = view.scimoz;
                    }
                    if (!observer_arguments) {
                        retval = part.evalAsPython(document, window, editor,
                                                   koDoc, view,
                                                   part.value, asynchronous);
                    } else {
                        retval = part.evalAsPythonObserver(document, window, editor,
                                                   koDoc, view,
                                                   part.value,
                                                   false,
                                                   observer_arguments['subject'],
                                                   observer_arguments['topic'],
                                                   observer_arguments['data']);
                    }
                } catch (e) {
                    log.exception(e);
                    var lastErrorSvc = Components.classes["@activestate.com/koLastErrorService;1"].
                                       getService(Components.interfaces.koILastErrorService);
                    exception = lastErrorSvc.getLastErrorMessage();
                }
                break;
            default:
                retval = "Macros written in '"+language+"' aren't supported."
        }
        if (exception) {
            ko.dialogs.alert("There was a problem executing the macro: " +
                         part.getStringAttribute('name'), exception);
            return true;
        } else {
            return retval;
        }
    } catch (e) {
        log.exception(e);
    } finally {
        ko.macros.recorder.resumeRecording();
    }
    return false;
}

this.macroProperties = function macro_editProperties(item)
{
    var obj = new Object();
    obj.item = item;
    obj.task = 'edit';
    //XXX Would be better to get this from the class, but it isn't exposed.
    obj.imgsrc = 'chrome://komodo/skin/images/macro.png'; 
    window.openDialog(
        "chrome://komodo/content/project/macroProperties.xul",
        "Komodo:MacroProperties",
        "chrome,centerscreen,close=yes,dependent=no,resizable=yes", obj);
}



}).apply(ko.projects);



(function() {

function MacroEventHandler() {
    this._hookedMacrosByTrigger = {
        'trigger_startup' : [],
        'trigger_postopen' : [],
        'trigger_presave' : [],
        'trigger_postsave' : [],
        'trigger_preclose' : [],
        'trigger_postclose' : [],
        'trigger_quit' : [] ,
        'trigger_observer' : []
        };
    var obsSvc = Components.classes["@mozilla.org/observer-service;1"].
                       getService(Components.interfaces.nsIObserverService);
    obsSvc.addObserver(this, 'macro-load', false);
    obsSvc.addObserver(this, 'macro-unload', false);
    obsSvc.addObserver(this, 'javascript_macro',false);
    obsSvc.addObserver(this, 'command-docommand',false);
    obsSvc.addObserver(this, 'toolbox-loaded', false);

    ko.main.addWillCloseHandler(this.finalize, this);

    this.log = ko.logging.getLogger('macros.eventHandler');
    //this.log.setLevel(ko.logging.LOG_DEBUG);
    this._trigger_observers = {};
}

MacroEventHandler.prototype.finalize = function() {
    try {
    var obsSvc = Components.classes["@mozilla.org/observer-service;1"].
                       getService(Components.interfaces.nsIObserverService);
    obsSvc.removeObserver(this, 'macro-load');
    obsSvc.removeObserver(this, 'macro-unload');
    obsSvc.removeObserver(this, 'javascript_macro');
    obsSvc.removeObserver(this, 'command-docommand');
    obsSvc.removeObserver(this, 'toolbox-loaded');
    } catch(ex) {
        this.log.exception(ex);
    }
}

MacroEventHandler.prototype._triggersAreEnabled = function() {
    var prefs = Components.classes["@activestate.com/koPrefService;1"].
    getService(Components.interfaces.koIPrefService).prefs;
    return prefs.getBooleanPref("triggering_macros_enabled");
};

MacroEventHandler.prototype._triggerWrapper = {
    observe : function(subject, topic, data) {
        // 'this' isn't 'me', so call the global singleton
        if (!ko) {
            //this ko has shutdown (or isn't defined yet)
            return false;
        } else if (!ko.macros.eventHandler._triggersAreEnabled()) {
            return false;
        }
        var observer_arguments = {
            subject: subject,
            topic  : topic,
            data   : data
        }
        var macro_list = ko.macros.eventHandler._hookedMacrosByTrigger['trigger_observer'];
        for (var macro, i = 0; macro = macro_list[i]; i++) {
            if (macro.hasAttribute("trigger_observer_topic")
                && macro.getStringAttribute("trigger_observer_topic") == topic
                && ko.projects.executeMacro(macro, macro.getBooleanAttribute('async'),
                                            observer_arguments)) {
                return true;
            }
        }
        return false;
    }
};
    
MacroEventHandler.prototype.callHookedMacros = function(trigger, viewOrURI) {
    if (!this._triggersAreEnabled()) {
        return false;
    }
    var observer_arguments;
    if (typeof(viewOrURI) != 'undefined') {
        observer_arguments = {
            subject: viewOrURI,
            topic  : null,
            data   : null
        };
    } else {
        observer_arguments = null;
    }
    var macro_list = this._hookedMacrosByTrigger[trigger];
    for (var macro, i = 0; macro = macro_list[i]; i++) {
        if (ko.projects.executeMacro(macro, macro.getBooleanAttribute('async'),
                                     observer_arguments)) {
            return true;
        }
    }
    return false;
}

MacroEventHandler.prototype._findMacro = function(macro_list, macropart) {
    for (var i = 0; i < macro_list.length; i++) {
        if (macro_list[i].id == macropart.id) {
            return i;
        }
    }
    return -1;
};

// Sort ascending; sort unranked macros after ranked, 
// and preserve temporal order -- new macros appear after
// equivalently ordered old ones.

MacroEventHandler.prototype._insertNewMacro = function(macro_list, new_macro) {
    if (!new_macro.hasAttribute('rank')) {
        // The newest unranked macro goes on the end.
        macro_list.push(new_macro);
        return;
    }
    var new_rank_val = new_macro.getLongAttribute('rank');
    var pos = macro_list.length; // A.splice(A.len, 0, item) === A.push(item)
    for (var curr_macro, i = 0; curr_macro=macro_list[i]; i++) {
        if (!curr_macro.hasAttribute('rank')) {
            pos = i;
            break;
        }
        if (new_rank_val < curr_macro.getLongAttribute('rank')) {
            pos = i;
            break;
        }
    }
    macro_list.splice(pos, 0, new_macro);
}

MacroEventHandler.prototype.addMacro = function(macropart) {
    // A macro has been added -- we should find out if it
    // has any 'hooks'
    if (macropart.hasAttribute('trigger_enabled') &&
        macropart.getBooleanAttribute('trigger_enabled')) {
        var trigger = macropart.getStringAttribute('trigger');
        var macro_list = this._hookedMacrosByTrigger[trigger];
        var idx = this._findMacro(macro_list, macropart);
        if (idx >= 0) {
            // This routinely happens when a toolbox or project containing
            // trigger macros is reloaded.
            this.log.info("Couldn't add macro "
                          + macropart.id
                          + " ("
                          + macropart.name
                          + ") to list of hooked macros for trigger "
                          + trigger
                          + ": it was already in the list.");
            return;
        }
        this._insertNewMacro(macro_list, macropart);
        if (trigger == 'trigger_observer') {
            this._addObserverMacro(macropart);
        }
    } else {
        this.log.debug("Macro " + macropart.name + " has no trigger");
    }
}

MacroEventHandler.prototype.loadTriggerMacros = function() {
    macros = ko.toolbox2.getTriggerMacros();
    var this_ = this;
    macros.map(function(macro) {
            dump("Loaded trigger macro "
                 + macro.name
                 + "\n");
            this_.addMacro(macro);
        });
};

/*
  // Currently not called.
MacroEventHandler.prototype.unloadTriggerMacros = function() {
    for (var topic in this._trigger_observers) {
        var obsSvc = Components.classes["@mozilla.org/observer-service;1"].
               getService(Components.interfaces.nsIObserverService);
        obsSvc.removeObserver(this._triggerWrapper, topic);
        delete this._trigger_observers[topic];
    }
    for (var prop in this._hookedMacrosByTrigger) {
        this._hookedMacrosByTrigger[prop] = [];
    }
};
*/

MacroEventHandler.prototype._addObserverMacro = function(macropart) {
    var topic = macropart.getStringAttribute('trigger_observer_topic');
    if (!(topic in this._trigger_observers)) {
        this._trigger_observers[topic] = 1;
        var obsSvc = Components.classes["@mozilla.org/observer-service;1"].
               getService(Components.interfaces.nsIObserverService);
        obsSvc.addObserver(this._triggerWrapper, topic, false);
        // XXX: Removed: The koObserverService are instances, this looks like it
        //      was trying to tie into the koIDocument observer notifications,
        //      but these are per document instances and not a global.
        // Put it on the ActiveState observer service as well
        //obsSvc = Components.classes['@activestate.com/koObserverService;1'].
        //       getService(Components.interfaces.nsIObserverService);
        //obsSvc.addObserver(this._triggerWrapper, topic, false);
    } else {
        this._trigger_observers[topic] += 1;
    }
};

MacroEventHandler.prototype._removeObserverMacro = function(macropart, topic) {
    if (!(topic in this._trigger_observers)) {
        this.log.warn("Unexpected precondition failure: "
                      + "Removing an unused observer ("
                      + topic
                      + "), macro "
                      + macropart.name
                      + ", project "
                      + macropart.project.url
                      + "\n");
        return;
    }
    this._trigger_observers[topic] -= 1;
    if (this._trigger_observers[topic] <= 0) {
        var obsSvc = Components.classes["@mozilla.org/observer-service;1"].
               getService(Components.interfaces.nsIObserverService);
        obsSvc.removeObserver(this._triggerWrapper, topic);
        // XXX: Removed: The koObserverService are instances, this looks like it
        //      was trying to tie into the koIDocument observer notifications,
        //      but these are per document instances and not a global.
        //obsSvc = Components.classes['@activestate.com/koObserverService;1'].
        //       getService(Components.interfaces.nsIObserverService);
        //obsSvc.removeObserver(this._triggerWrapper, topic);
        delete this._trigger_observers[topic];
    }
};

MacroEventHandler.prototype.updateMacroHooks = function(item, old_props, new_props) {
    var trigger_topic = (old_props.trigger == 'trigger_observer'
                         ? old_props.trigger_observer_topic : null);
    if (!old_props.trigger_enabled) {
        if (new_props.trigger_enabled) {
            this.addMacro(item);
        }
    } else if (!new_props.trigger_enabled) {
        this.removeMacro(item, old_props.trigger, trigger_topic);
    } else if (old_props.trigger != new_props.trigger) {
        this.removeMacro(item, old_props.trigger, trigger_topic);
        this.addMacro(item);
    } else if (new_props.trigger == 'trigger_observer'
               && (old_props.trigger_observer_topic
                   != new_props.trigger_observer_topic)) {
        this.removeMacro(item, old_props.trigger, trigger_topic);
        this.addMacro(item);
    } else if (old_props.rank != new_props.rank) {
        var macro_list = this._hookedMacrosByTrigger[new_props.trigger];
        var idx = this._findMacro(macro_list, item);
        if (idx >= 0) {
            macro_list.splice(idx, 1); // remove it
        } else {
            this.log.info("Expected to find macro "
                          + item.name
                          + " on the list for "
                          + new_props.trigger
                          + ", but didn't\n.");
        }
        this._insertNewMacro(macro_list, item);
        // No updates needed for notification triggers
    }
};

MacroEventHandler.prototype.removeMacro = function(macropart, trigger, topic) {
    // A macro has been removed -- we should remove it from
    // the list of hooks
    try {
        if (typeof(trigger) == "undefined") {
            // See if we have this macro in a list
            if (macropart.hasAttribute('trigger_enabled') &&
                macropart.getBooleanAttribute('trigger_enabled')) {
                trigger = macropart.getStringAttribute('trigger');
            } else {
                return;
            }
        }
        var macro_list = this._hookedMacrosByTrigger[trigger];
        var idx = this._findMacro(macro_list, macropart);
        if (idx >= 0) {
            macro_list.splice(idx, 1); // remove it
            if (trigger == 'trigger_observer') {
                if (typeof(topic) == "undefined") {
                    topic = ((macropart.getStringAttribute("trigger_observer_topic"))
                             ? macropart.getStringAttribute("trigger_observer_topic") : null);
                }
                if (topic) {
                    this._removeObserverMacro(macropart, topic);
                } else {
                    this.log.warn("Can't find a topic for observer "
                                  + macropart.name
                                  + " in project "
                                  + macropart.project.name);
                }
            }
            return;
        }
    } catch (e) {
        this.log.exception(e);
    }
    this.log.error("Couldn't remove macro from list of hooked macros.");
}

var _didStartup = false;
var _delayedHooks = [];

function _runDelayedHooks(this_) {
    var hook;
    for (var i = 0; i < _delayedHooks.length; ++i) {
        hook = _delayedHooks[i];
        hook[0].call(this_, hook[1]);
    }
    _delayedHooks = [];
}

MacroEventHandler.prototype.hookOnStartup = function() {
    _didStartup = true;
    var res = this.callHookedMacros('trigger_startup');
    _runDelayedHooks(this);
    return res;
}

MacroEventHandler.prototype.hookPostFileOpen = function(view) {
    if (!_didStartup) {
        _delayedHooks.push([this.hookPostFileOpen, view]);
        return false;
    }
    return this.callHookedMacros('trigger_postopen', view);
}

MacroEventHandler.prototype.hookPreFileSave = function(view) {
    return this.callHookedMacros('trigger_presave', view);
}

MacroEventHandler.prototype.hookPostFileSave = function(view) {
    return this.callHookedMacros('trigger_postsave', view);
}

MacroEventHandler.prototype.hookPreFileClose = function(view) {
    return this.callHookedMacros('trigger_preclose', view);
}

MacroEventHandler.prototype.hookPostFileClose = function(uri) {
    return this.callHookedMacros('trigger_postclose', uri);
}

MacroEventHandler.prototype.hookOnQuit = function peMacro_hookOnQuit() {
    if (this.callHookedMacros('trigger_quit')) {
        ko.statusBar.AddMessage("Macro interrupted shutdown procedure.",
                             "macro",
                             5000,
                             true);
        return false;
    }
    return true;
}

MacroEventHandler.prototype.observe = function(part, topic, code)
{
    try {
        switch (topic) {
            case 'macro-load':
                if (ko.windowManager.getMainWindow() != window) {
                    return;
                }
            dump("macro-load: " + part.name + "\n");
                this.addMacro(part);
                break;
            case 'macro-unload':
                if (ko.windowManager.getMainWindow() != window) {
                    return;
                }
            dump("macro-unload: " + part.name + "\n");
                this.removeMacro(part);
                break;
            case 'javascript_macro':
                if (ko.windowManager.getMainWindow() != window) {
                    return;
                }
                // dump("part = " + part + "\n");
                ko.macros.evalAsJavaScript(code);
                break;
            case 'command-docommand':
                // Called from a Python macro
                // If the user does a multi-window switch into code
                // that runs komodo.doCommand() outside a macro context,
                // this command might not run as expected.
                if (part == window) {
                    ko.commands.doCommand(code);
                } else {
                    //this.log.debug("command-docommand: not in current window for code: " + code);
                }
                break;
            case 'toolbox-loaded':
                if (ko.windowManager.getMainWindow() != window) {
                    return;
                }
                this.loadTriggerMacros();
                break;
        };
    } catch (e) {
        log.exception(e);
    }
}
this.eventHandler = new MacroEventHandler();
// safe to use ko.main because this file is loaded only in komodo.xul

// Calling addCanCloseHandler is the same as explicitly observing
// quit-application-requested and then calling ko.macros.eventHandler.hookOnQuit()
// This way is simpler because we don't have to QI the observe function's first arg
// for nsIBoolean, and handle the double-negative (set the .data field to true if we
// want to quit, but hookOnQuit() returns false if we're to quit).
ko.main.addCanCloseHandler(function () { return ko.macros.eventHandler.hookOnQuit() });



function _macro_error(ex, action, part) {
    //log.exception(ex);
    var msg;
    var title;
    if (ex.name == "SyntaxError") {
        title = "Syntax Error";
        if (part) {
            msg = "Syntax error in macro "+part.name+":\n\n";
        } else {
            msg = "Syntax error in macro:\n\n";
        }
        msg += ko.logging.strObject(ex, "exception");
    } else {
        title = "Runtime Error";
        if (part) {
            msg = "Error while " + action + " in macro "+part.name+":\n\n";
        } else {
            msg = "Error while " + action + " macro:\n\n";
        }
        msg = (msg + ex.name + ": " +
               ex.message + "\n\n" +
               ko.logging.strObject(ex, "exception"));
    }
    var prompt;
    if (part) {
        prompt = "Error "+action+" in macro "+part.name+".";
    } else {
        prompt = "Error "+action+" macro."
    }
    ko.dialogs.alert(prompt, msg, title, null, "chrome,modal,titlebar,resizable");
}

//@@@@ v5 => v6 transition code
this.__defineGetter__("current",
function()
{
    var _partSvc = Components.classes["@activestate.com/koPartService;1"]
            .getService(Components.interfaces.koIPartService);
    try {
        return _partSvc.runningMacro;
    } catch(ex) {
        // Try the toolbox2 service
        _partSvc = Components.classes["@activestate.com/koToolBox2Service;1"]
            .getService(Components.interfaces.koIToolBox2Service);
        return _partSvc.runningMacro;
    }
});

//@@@@ v5 => v6 transition code
this.__defineSetter__("current",
function(macro)
{
    var _partSvc = Components.classes["@activestate.com/koPartService;1"]
            .getService(Components.interfaces.koIPartService);
    try {
        _partSvc.runningMacro = macro;
    } catch(ex) {
        // Try the toolbox2 service
        _partSvc = Components.classes["@activestate.com/koToolBox2Service;1"]
            .getService(Components.interfaces.koIToolBox2Service);
        _partSvc.runningMacro = macro;
    }
});

this.evalAsJavaScript = function macro_evalAsJavascript(__code,
                                                        part, /* = null */
                                                        __observer_arguments, /* = null */
                                                        view /* = currentView */
                                                        ) {
    try {
        if (typeof(part) == 'undefined') {
            part = null;
        }
        if (typeof(__observer_arguments) == 'undefined') {
            __observer_arguments = null;
        }
        if (typeof(view) == 'undefined' || view == null) {
            try {
                view = ko.views.manager.currentView;
            } catch(ex) {}
        }

        ko.macros.current = part;
        var komodo = new _KomodoJSMacroAPI(part, view);
        var __retcode = -1;
        var __header = (__observer_arguments ? "subject, topic, data" : "");
        try {
            var __compiled_func = (__observer_arguments
                                   ? new Function('komodo', 'subject', 'topic', 'data', __code)
                                   : new Function('komodo', __code));
            // eval("(function(" + __header + ") { \n" + __code + "\n })");
            try {
                __retcode = (__header
                             ? __compiled_func(komodo,
                                               __observer_arguments.subject,
                                               __observer_arguments.topic,
                                               __observer_arguments.data)
                             : __compiled_func(komodo));
            } catch(rex) {
                _macro_error(rex, "running", part);
            }
        } catch (cex) {
            _macro_error(cex, "compiling", part);
        }
        komodo.destructor();
        delete komodo;
        ko.macros.current = null;
        return __retcode;
    } catch (e) {
        log.exception(e);
    }
    return false;
}

this.recordPartInvocation = function macro_recordPartInvocation(part) {
    try {
        // We'll do the macro work ourselves using the name of the part
        // instead of the encoded contents of the run command -- the
        // resulting macro has a _reference_ to the run command, which
        // seems more representative of what the user expects (and means
        // that the run command can be developed independently of the
        // macro.
        var wko = ko.windowManager.getMainWindow().ko;
        if (typeof(wko.macros.recorder) != 'undefined' &&
            wko.macros.recorder &&
            wko.macros.recorder.mode == 'recording') {
            var name = part.getStringAttribute('name');
            var type = part.type;
            var runtxt = "_part = komodo.findPart('"+type+"', '" + name + "'" + ", '*')\n";
            runtxt += "if (!_part) {alert(\"Couldn't find a " + type + " called '" + name + "' when executing macro.\"); return\n}\n";
            runtxt += "ko.projects.invokePart(_part);\n";
            wko.macros.recorder.appendCode(runtxt);
        }
    } catch (e) {
        log.exception(e);
    }
}


/**
 * Komodo JS Macro Object, DEPRECATED
 *
 * The original Komodo JS Macro object is deprecated, use the following
 * to map to the current correct usage
 * 
 * komodo.doc -> ko.views.manager.currentView.koDoc (DEPRECATED in Komodo 6.0.0b1, use `koDoc`)
 * komodo.document -> ko.views.manager.currentView.koDoc (DEPRECATED in Komodo 6.0.0b1, use `koDoc`)
 * komodo.koDoc -> ko.views.manager.currentView.koDoc
 * komodo.editor -> ko.views.manager.currentView.scimoz
 * komodo.view -> ko.views.manager.currentView
 * komodo.macro -> macro (ie. the running macro, koIPart_macro interface, available in 4.2)
 * komodo.openURI -> ko.open.URI
 * komodo.window -> window
 * komodo.domdocument -> document
 * komodo.components -> Components
 * komodo.doCommand -> ko.commands.doCommand
 * komodo.getWordUnderCursor -> ko.interpolate.getWordUnderCursor(ko.views.manager.currentView.scimoz)
 * komodo.interpolate -> ko.interpolate.interpolateString
 * 
 * 
 * komodo.interpolate is more correctly emulated by doing:
 * 
 * var queryTitle = "Macro '"+macro.getStringAttribute("name")+"' Query";
 * result = ko.interpolate.interpolateString(s, bracketed, queryTitle);
 */
function _KomodoJSMacroAPI(macro, view)
{
    log.debug("_KomodoJSMacroAPI()");
    try {
        this.koDoc = this.doc = this.document = null;
        if (view && view.koDoc) {
            this.koDoc = this.doc = this.document = view.koDoc;
        }
        this.editor = null;
        if (view && view.scimoz) {
            this.editor = view.scimoz;
        }
        this.view = view;
        this.macro = macro;
        // Point this function to the global JS function
        this.openURI = ko.open.URI;

        this.window = window;
        this.domdocument = document;
        this.components = Components;

    } catch(ex) {
        log.exception(ex);
    }
}
_KomodoJSMacroAPI.prototype.constructor = _KomodoJSMacroAPI;

_KomodoJSMacroAPI.prototype.destructor = function() {
    delete this.editor;
    delete this.view;
    delete this.window;
    delete this.koDoc;
    //TODO: add this too? `delete this.doc;`
    delete this.document;
    delete this.domdocument;
}

_KomodoJSMacroAPI.prototype.assertMacroVersion = function(version) {};
_KomodoJSMacroAPI.prototype.doCommand = ko.commands.doCommand;
_KomodoJSMacroAPI.prototype.findPart = ko.projects.findPart;
_KomodoJSMacroAPI.prototype.getWordUnderCursor = function()
{
    return ko.interpolate.getWordUnderCursor(this.editor);
}

_KomodoJSMacroAPI.prototype.interpolate = function(s, bracketed /*=false*/)
{
    var queryTitle = null;
    if (this.macro) {
        queryTitle = "Macro '"+this.macro.getStringAttribute("name")+"' Query";
    }
    return ko.interpolate.interpolateString(s, bracketed, queryTitle);
}

}).apply(ko.macros);

var gPeMacro = ko.macros.eventHandler;
var peMacro_addMacro = ko.projects.addMacro;
var macro_executeMacro = ko.projects.executeMacro;
var macro_editProperties = ko.projects.macroProperties;
var macro_executeMacroById = ko.projects.executeMacroById;
var macro_evalAsJavascript = ko.macros.evalAsJavaScript;
var macro_recordPartInvocation = ko.macros.recordPartInvocation;
