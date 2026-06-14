// -zw

var usedIds = [];

var started = false;

let disableShortcuts = false;

const namedSymbols = ["|", "%", "@", "*", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "<", ">", "?", "!", "~", "^", "&", "$", ".", "#"];
const namedNames = ["pipe", "percent", "at", "star", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "zero", "left", "right", "questn", "exclm", "tilde", "up", "and", "dollar", "dot", "hashtag", "equals"];

class editorNodeGroup {
    constructor(name, nodes)
    {
        this.name = name;
        this.nodes = nodes;
    }
}

var connected = [];
var usedNames = [];

var selected;
var selectedType = "";
var selectedElement;

var whichNode = 0;
var drw = false;
var isOut = false;

let commandSpawnPoint = { x: 250, y: 250};

var template = [];

// 'editorVars' stores the names, 'Types' stores the type, and 'Defaults' stores the starting value
// Type Legend: 0 = Boolean, 1 = Colour, 2 = String, 3 = Integer, 4 = Float
var Types = [0];
var Defaults = [false];
var VariableSelect = 0;
var TypeSelect = 0;
var Arrows = [];
var ArrowInterval;
var registeredNodes = [];
var FlipE = false;
var FlipB = false;
var FlipI = false;
var FlipF = false;
var FlipS = false;
var FlipA = false;
// Latch: true is open
var SpawnLatch = true;

var Searching = false;

const varsElement = document.getElementById("editorvars");
const graph = document.getElementById("Graph");
let searchBox = $("#contextSearch");

function GetNodeIdFromName(name)
{
    let id = "";
    name = name.toLowerCase();

    for (let i = 0; i < namedSymbols.length; i++)
        name = name.replaceAll(namedSymbols[i], namedNames[i]);

    for (let char of name)
    {
        if ("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_".includes(char))
            id += char;
    }

    return id;
}

class editorNode{
    constructor(name, type, output, io, link, temporary=false)
    {
        if (name.constructor === Array)
        {
            if (name.length < 5 || name.length > 6)
            {
                ModuleLoadError("Malformed Editor Node: " + name);
            } 
            this.name = name[0].trim().UnEscape();
            this.type = name[1].trim().UnEscape();
            this.output = name[2].trim().UnEscape();
            this.io = name[3].trim().UnEscape();
            this.link = name[4].trim().UnEscape();
        }
        else
        {
            this.name = name.UnEscape();
            // Type is a number indicating type
            // 0 = basic function
            // 1 = function from an object (first parameter is self)
            // 2 = It needs brackets (for, while, stuff like that)
            // 3 = Reference to something. It's not a function
            this.type = type;

            // The code to replace the node with
            // for example a python print node would be "print(%0)",
            // %n means to be replaced with the n'th parameter.
            this.output = output.UnEscape();

            // IO:
            // Syntax: type.Name;o.;type.Name;
            // Where x is the type. (e (exec), b (bool), s (string), i (integer), f (float), F (file))
            // o.; is the divide between inputs and outputs.
            // For example an if node would be e.In;b.Condition;o.;e.True;e.False;
            this.io = io.UnEscape();

            // Link to documentation regarding the specific node
            this.link = link;
        }

        if (!temporary)
        {
            this.addedNodes = [];

            this.id = GetNodeIdFromName(this.name);

            if (usedIds.includes(this.id))
            {
                ModuleLoadError("This node id already exists: [" + this.id + "], Original Name: [" + this.name + "]");
            }
            usedIds.push(this.id);
        }
    }
}

// GUI Variables are stored in an array, their index corrosponds to the Types and Defaults array.
var editorVars = [];

var editorStructs = [];
// Arrays for All-Commands-Search
const unsortedIndex = 3;
var Commands = [
    new editorNodeGroup("Starting", []),
    new editorNodeGroup("ConstTypes", []),
    new editorNodeGroup("Hidden", []), // nodes that the editor needs, but shouldn't show up in the menus.
    new editorNodeGroup("Unsorted", [])
];

class editorType
{
    constructor(name, letter, idleIcon, connectIcon, colour, output, input)
    {
        if (name.constructor === Array)
        {
            if (name.length !== 7)
            {
                ModuleLoadError("Malformed Editor Type: " + name);
            } 
            this.name = name[0].trim();
            this.letter = name[1].trim();
            this.icons = [name[2].trim(), name[3].trim()];
            this.colour = name[4].trim();
            this.output = name[5].trim();
            this.input = name[6].trim();
        }
        else
        {
            this.name = name;
            this.letter = letter;
            this.icons = [idleIcon, connectIcon];
            this.colour = colour;
            this.output = output;
            this.input = input;
        }
        for (let i of GetTypeOverrides())
        {
            if ((i.split(",")[0] == this.name) && i.split(",")[1])
            {
                this.colour = i.split(",")[1];
                break;
            }
        }
    }
}
/*
const originalEditorTypes = [
    new editorType("exec", "e", "caret-right", "caret-square-o-right", "#FFFFFF", "%", "<input type='checkbox'>"),
    new editorType("auto", "g", "circle-thin", "circle", "#0093F5", "%", "text"),
    new editorType("Function", "fn", "circle-thin", "circle", "#4800FF", "%", "text"),
];
*/

function ResetEditorTypes()
{
    editorTypes.push(new editorType("exec", "e", "caret-right", "caret-square-o-right", "#FFFFFF", "%", "<input type='checkbox'>"), new editorType("auto", "g", "circle-thin", "circle", "#0093F5", "%", "text"), new editorType("diazo_type", "diazo_type", "", "", "", "%", "diazo_type"));
}

var editorTypes = [];
ResetEditorTypes();


function GetTypeFromLetter(letter)
{
    for (let t of editorTypes)
    {
        if (t.letter == letter)
        {
            return t;
        }
    }
    return null;
}

function TypeExists(name)
{
    for (let t of editorTypes)
    {
        if (t.name == name)
        {
            return true;
        }
    }
    return false;
}

function GetTypeFromName(name)
{
    for (let t of editorTypes)
    {
        if (t.name == name)
        {
            return t;
        }
    }
    return editorTypes[0];
}

function GetTypeLetterFromName(name)
{
    if (name === "void")
        return "e";

    for (let t of editorTypes)
    {
        if (t.name == name)
        {
            return t.letter;
        }
    }
    return name;
}

function GetIconFromLetter(letter)
{
    let t = GetTypeFromLetter(letter);
    if (t)
    {
        return t.icons;
    }
    return ["circle-thin", "circle"]
}

const outputWindow = document.getElementById("nodecodeoutput");
function Print(string)
{
    outputWindow.innerText += string + "\n";
}

function MakeVariableName(name)
{
    return GetSetting("var-fmt").replace("%name", name);
}

class editorVariable
{
    constructor(name, type)
    {
        this.name = name;
        this.type = GetTypeLetterFromName(type);
        Commands[unsortedIndex].nodes.push(new editorNode("Get " + this.name, "1", MakeVariableName(this.name), "o.;" + this.type + ".;", ""));
        Commands[unsortedIndex].nodes.push(new editorNode("Set " + this.name, "7", this.name, "e.;" + this.type + ".;o.;e.;v." + MakeVariableName(this.name) + "." + this.type + ".Get " + this.name + ";", ""));
    }
}

function AddEditorVariable(inputs)
{
    editorVars.push(new editorVariable(inputs[0].value, inputs[1].innerHTML));
    RefreshVars();
    SaveVariables();
    RefreshCmdBtns();
}

Boolean.prototype.toInt = function() {
    return [false, true].indexOf(this.valueOf());
};

class editorStructMethod
{
    constructor(parent, name, io, link)
    {
        let isMakeNode = false;

        if (name.constructor === Array)
        {
            if (name.length !== 3)
                MakeCustomDialog("Module Load Error", "Malformed Editor Struct Method: " + name, ["Ok"], function() {});

            this.name = name[0].trim() + " (" + parent.name + ")";
            this.io = name[1].trim();
            if (name[0].trim() == parent.name)
            {
                isMakeNode = true;
                this.name = "Make " + parent.name;
                if (this.io.split("o.;")[1] && parent.numNewNodes)
                {
                    let firstOutNub = this.io.split("o.;")[0].split(";");
                    let distinguishingIndex = 0;
                    let newName;
                    do
                    {
                        let nub = firstOutNub[distinguishingIndex].split(".");
                        newName = this.name + " (" + GetTypeFromLetter(nub[nub.length - 2]).name + ")";
                        distinguishingIndex += 1;
                    } while (usedIds.includes(GetNodeIdFromName(newName)))

                    this.name = newName;
                }
                parent.numNewNodes += 1;

            }

            this.functionname = name[0].trim();

            this.link = name[2].trim();
        }
        else
        {
            this.name = name + " (" + parent.name + ")";
            this.functionname = name;
            this.io = io;
            this.link = link;
        }
        let params = "";
        let newio = "";
        if (!isMakeNode)
            newio = ((parent.isStatic === 'true') ? "p." + parent.name + "." : "") + parent.name + "." + parent.name + ";";

        if (this.io)
        {
            let iosplit = this.io.split("o.;");
            iosplit = iosplit[0].split(";");
            let end = iosplit.length - 1;
            let j = isMakeNode ? -1 : 0;
            for (let i = 0; i < end; i++)
            {
                if (iosplit[i].split(".")[0] != "e")
                {
                    params += "%" + ++j + ",";
                }
            }
            params = params.substring(0, params.length - 1);

            this.io = this.io.split("o.;");
            if (this.io[0].substring(0, "e.;".length) === "e.;")
                this.io[0] = "e.;" + newio + this.io[0].substring("e.;".length);
            else
                this.io[0] = newio + this.io[0];

            this.io = this.io.join("o.;");
        }
        else
            this.io = "e.;" + newio + "o.;e.;";

        let isExec = (this.io.includes(";e.;") || this.io.startsWith("e.;")).toInt();
        let fmt = parent.funcfmt;
        if (isMakeNode)
            fmt = GetSetting("struct-new");

        fmt = fmt.replaceAll("%this", "%0").replaceAll("%name", this.functionname).replace("%params", params);

        parent.nodes.push(new editorNode(this.name, (1 - isExec).toString(), fmt, this.io, this.link));
    }
}

class editorStructProperty
{
    constructor(parent, name, type, readwrite, link)
    {
        if (name.constructor === Array)
        {
            if (name.length !== 4)
                MakeCustomDialog("Module Load Error", "Malformed Editor Struct Property: " + name, ["Ok"], function() {});

            this.name = name[0].trim();
            this.functionname = name[0].trim();
            this.type = name[1].trim();
            this.readwrite = name[2].trim();
            this.link = name[3].trim();
        }
        else
        {
            this.name = name;
            this.functionname = name;
            this.type = type;
            this.readwrite = readwrite;
            this.link = link;
        }
        this.type = GetTypeLetterFromName(this.type);

        let fmt = parent.propfmt.replaceAll("%this", "%0").replaceAll("%name", this.functionname);
        if (this.readwrite.includes("r"))
            parent.nodes.push(new editorNode("Get " + this.name + " (" + parent.name + ")", "1", fmt, ((parent.isStatic === 'true') ? ("p." + parent.name + ".") : "") + parent.name + "." + parent.name + ";o.;" + this.type + ".;", ""))

        if (this.readwrite.includes("w"))
            parent.nodes.push(new editorNode("Set " + this.name + " (" + parent.name + ")", "0", MakeAssign(fmt, this.type, "%1"), "e.;" + ((parent.isStatic === 'true') ? ("p." + parent.name + ".") : "") + parent.name + "." + parent.name + ";" + this.type + ".;o.;e.;v.[" + fmt.replace("%0", "%1") + "]." + this.type + ".Get " + this.name + ";", ""))
    }
}

function FormatVarSign(name, value)
{
    return GetSetting("var-sign").replaceAll("%name", name).replaceAll("%val", value);
}

function FormatNewStruct(name, params)
{
    return GetSetting("struct-new").replaceAll("%name", name).replaceAll("%params", params);
}

function MakeBasicDialog(title, description)
{
    MakeCustomDialog(title, description, ["Ok"], function() {});
}

class editorStruct
{
    constructor(name, colour, isStatic, properties, methods, link, propfmt="%this.%name", funcfmt="%this.%name(%params)")
    {
        let props;
        let mes;
        if (name.constructor === Array)
        {
            if (name.length !== 8)
            {
                ModuleLoadError("Malformed Editor Struct Method: " + name);
            }
            this.name = name[0].trim();
            this.colour = name[1].trim();
            this.isStatic = name[2].trim();
            this.propfmt = name[3].trim();
            this.funcfmt = name[4].trim();
            props = name[5].trim();
            mes = name[6].trim();
            this.link = name[7].trim();
        }
        else
        {
            this.name = name;
            this.colour = colour;
            this.isStatic = isStatic;
            props = properties;
            mes = methods;
            this.link = link;
            this.propfmt = propfmt;
            this.funcfmt = funcfmt;
        }

        this.numNewNodes = 0;

        this.nodes = [];
        this.properties = [];
        this.methods = [];

        // properties is a list of editorStructPropertys, which will generate Get and Set commands for them.
        editorTypes.push(new editorType(this.name, this.name, "circle-thin", "circle", this.colour, "%", ""))
        if (props !== "[]")
        {
            for (let line of props.trim().SmartSplit(","))
            {
                this.properties.push(new editorStructProperty(this, line.substring(1, line.length - 1).trim().SmartSplit(",")));
            }
        }
        
        let makenodes = [];

        if (mes !== "[]")
        {
            for (let line of mes.SmartSplit(","))
            {
                let split = line.substring(1, line.length - 1).SmartSplit(",");
                this.methods.push(new editorStructMethod(this, split));
            }
        }

        let innubs = "";
        let outnubs = "";
        for (let i of this.properties)
        {
            innubs += "v.[" + this.propfmt.replace("%this", "%0").replace("%name", i.name) + "]." + i.type + "." + i.name + ";";
            outnubs += i.type + "." + i.name + ";";
        }
        switch (this.isStatic.toLowerCase())
        {
            case "true":
                this.nodes.push(new editorNode("Get " + this.name, "1", this.name, "o.;" + this.name + "." + this.name + ";", ""));
                break;
            case "false":
                this.nodes.push(new editorNode("Break " + this.name, "1", "", this.name + "." + this.name + ";o.;" + innubs, ""));
                let newNubs = [];
                let thisname = "Make " + this.name;
                if (this.nodes.find(function(x) { return x === thisname; }) !== undefined)
                {
                    this.nodes.push(new editorNode(thisname, "1", FormatNewStruct(this.name, newNubs.join(GetSetting("param-separator"))), outnubs + "o.;" + this.name + "." + this.name + ";", ""));
                }

            default:
                break;
        }
        Commands.push(new editorNodeGroup(this.name, this.nodes));
    }
}

function RefreshVars()
{
    let varbtn = varsElement.parentElement.parentElement.previousElementSibling;
    GetSetting("var-fmt") ? varbtn.classList.remove('d-none') : varbtn.classList.add('d-none');

    let html = "";
    for (let i of editorVars)
    {
        html += "<div class=\"row\">";
            html += "<div class=\"col-5 px-0\">";
                html += "<button type=\"button\" class=\"btn btn-bloop cmdBtn w-100\"><sometext>Get " + i.name + "</sometext></button>";
            html += "</div>";

            html += "<div class=\"col-5 px-0\">";
                html += "<button type=\"button\" class=\"btn btn-bloop cmdBtn w-100\"><sometext>Set " + i.name + "</sometext></button>";
            html += "</div>";

            html += "<div class=\"col-2 px-0\">";
                html += "<button type=\"button\" class=\"btn btn-zdanger editor_deletevarbtn w-100\" editor_deltarget=\"" + i.name + "\"><i class=\"fa fa-trash\"></i></button>"
            html += "</div>"
        html += "</div>";
    }

    varsElement.innerHTML = html;

    $(".editor_deletevarbtn").off().on('click', function() {
        let variableName = this.getAttribute("editor_deltarget");
        AskToDelete("Delete Variable", variableName, function() {
            RemoveVariable(variableName);
        });
    });
}

$("#editor_addVar").click(function() {
    TriggerModal(NewVarModal, AddEditorVariable);
});

$("#editor_addFunc").click(function() {
    TriggerModal(NewFuncModal, NewFunction);
});

function SetLaunchInSafeMode(bLaunchInSafeMode)
{
    SetItem("editor_launchinsafemode", bLaunchInSafeMode)
}

function GetLaunchInSafeMode()
{
    return GetItem("editor_launchinsafemode") === 'true';
}

let shownError = false;

function ModuleLoadError(message)
{
    MakeCustomDialog("Error", "Module loading error:\n" + message, ["Continue", "Safe Mode"], function(result) {
        if (result === "Safe Mode")
        {
            SetLaunchInSafeMode(true);
            location.reload();
        }
    });
}

const custom_dialog = $("#customModal");
const custom_dialog_title = document.getElementById("customModalTitle");
const custom_dialog_text = document.getElementById("customModalText");
const custom_dialog_btns = document.getElementById("customModalBtns");

// I had to create my own dialog box since you can accidentally or not turn off alerts and confirms, which would disable important things like the New button and module error dialogs.
// I found that out the hard way
function MakeCustomDialog(title, desc, options, resultfunc)
{
    let colwidth = Math.floor(12 / options.length);
    let text = "";
    custom_dialog_title.innerText = title;
    custom_dialog_text.innerText = desc;
    for (let i of options)
    {
        text += "<div class=\"col-" + colwidth + " px-0\"><button class=\"btn btn-block btn-bloop custom_modal_close\">" + i + "</button></div>"
    }
    custom_dialog_btns.innerHTML = text;
    custom_dialog.collapse('show');

    $(".custom_modal_close").click(function() {
        resultfunc(this.innerHTML);
        custom_dialog.collapse('hide');
    });
}

function AskToDelete(title, name, func)
{
    MakeCustomDialog(title, "Are you sure you want to remove \'" + name + "\'?", ["Yes", "No"], function(result) {
        if (result == "Yes")
            func();
    });
}

// Only splits by one character
String.prototype.SmartSplit = function(splitby) {
    let finalList = [""];
    let depth = 0;
    for (let char of this)
    {
        if ("([{".includes(char))
        {
            depth++;
        }
        if (")]}".includes(char))
        {
            depth--;
        }
        if (!depth)
        {
            if (char == splitby)
            {
                finalList.push("");
                continue;
            }
        }
        finalList[finalList.length - 1] += char;
    }
    return finalList;
};

function ProcessStructBuffer(buffer)
{
    let splt = buffer.trim().replaceAll("\r\n", "\n").replaceAll("\r", "\n").split("\n\n");
    let text;
    let i1, i2, m1, m2, es;
    for (let s of splt)
    {
        s = s.trim();
        if (s)
        {
            i1 = s.indexOf("[");
            i2 = s.indexOf("]");
            m1 = s.lastIndexOf("(");
            m2 = s.lastIndexOf(")");
            
            text =  s.replace(s.substring(i1, i2), "[" + s.substring(i1 + 1, i2).trim().replaceAll("\n", "],[").replaceAll("\t", "").replaceAll("[],", "").replaceAll(",[]", ""));
            text = text.replace(s.substring(m1, m2 + 1), "[" + s.substring(m1 + 1, m2).trim().replaceAll("\n", "],[").replaceAll("\t", "").replaceAll("[],", "").replaceAll(",[]", "") + "]");
            es = new editorStruct(text.trim().SmartSplit("\n"));
            editorStructs.push(es);
        }
    }
}

function MakeSafe(input) {
    return input.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("\"", "&quot;");
}

function MakeUnSafe(input)
{
    return input.replaceAll("&amp;", "&").replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&quot;", "\"");
}

// I brought Python to JavaScript for this task
function zip(list1, list2)
{
    let outlist = [];
    let end = Math.min(list1.length, list2.length);
    for (let i = 0; i < end; i++)
        outlist.push([list1[i], list2[i]]);

    return outlist;
}

function ReplaceSeveral(haystack, needles, replaces)
{
    let noodles = zip(needles, replaces);
    noodles.sort(function (a, b) {
        return b[0].length - a[0].length;
    })

    for (let noodle of noodles)
        haystack = haystack.replaceAll(noodle[0], noodle[1]);

    return haystack;
}

function CToNub(z, isoutput)
{
    z = z.trim();

    if (z.includes(":"))
        return GetTypeLetterFromName(z.split(":")[1].trim()) + "." + (z.split(":")[0].replaceAll("_", " ")) + ";";

    if (z.includes(" "))
    {
        // Makes sure that nameless outputs with a type that contains spaces are still recognized.
        if (isoutput)
        {
            if (TypeExists(z))
                return GetTypeLetterFromName(z) + ".;";
        }

        z = z.replace(" restrict ", "");

        let group = z.split(" ");

        while (group.length > 2)
        {
            group[0] += " " + group[1];
            group.splice(1, 1);
        }

        return GetTypeLetterFromName(group[0]) + "." + (group[1].replaceAll("_", " ")) + ";";
    }

    // Outputs need at least their type
    if (isoutput)
        return GetTypeLetterFromName(z) + ".;";

    // Inputs need at least their name
    return "g." + z + ";";
}

// bTemporary means that the node is not going in the Commands menu, so it won't have an id reserved for it.
// I had plans to make the header files writable in TypeScript and even implemented it, but I ran into a couple logistical issues, I might make a new format.
function StandardCLineToNode(y, bStatic, bConst, bInline, bInput, bCompact, structname="", bTemporary=false, bCanTypeScript=false)
{
    if (y.startsWith(structname + "("))
        y = structname + " " + y;

    let namedex = y.lastIndexOf(" ", y.indexOf("("));
    let returnval = y.substring(0, namedex).trim();
    let name = y.substring(namedex + 1, y.indexOf("(")).trim();

    let bVoid = returnval == "void";

    let parameters = y.substring(y.indexOf("(") + 1, y.indexOf(")")).trim();

    let inputs = "";
    let outputs = "";

    if (y.includes("[[noreturn]]")) debugger;

    if (bVoid)
    {
        inputs += "e.;";
        outputs += "e.;";
    }
    else
    {
        if (returnval.includes(","))
        {
            for (let i of returnval.split(","))
                outputs += CToNub(i, true);
        }
        else
            outputs += CToNub(returnval, true);
    }
    let output = "";
    if (y.includes("{"))
        output = y.substring(y.indexOf("{") + 1).trim();

    let names = [];
    let outpms = [];
    let i = 0;
    let temp;
    if (parameters)
    {
        for (let p of parameters.SmartSplit(","))
        {
            p = p.trim();
            if (p == "...")
            {
                inputs += "a.g.;";
                outpms.push("%" + i);
                break;
            }
            let tokens = p.split(" ");
            if (p.includes(":"))
                tokens = p.split(":").toReversed();

            while (tokens.length > 2)
            {
                switch (tokens[0])
                {
                    case "const":
                        inputs += "i.";
                        break;
                    case "register":
                        inputs += "r.";
                        break;
                    default:
                        tokens[1] = tokens[0] + " " + tokens[1];
                        break;
                }
                tokens = tokens.slice(1);
            }

            if (tokens[1].includes("="))
            {
                temp = tokens[1].indexOf("=");
                inputs += "p." + tokens[1].substring(temp + 1) + ".";
                tokens[1] = tokens[1].substring(0, temp);
            }

            for (let i = 0; i < tokens.length; i++)
                tokens[i] = tokens[i].trim();

            inputs += GetTypeLetterFromName(tokens[0]) + "." + ((tokens[1].substring(0, 1) == "_") ? "" : tokens[1].replaceAll("_", " ")) + ";";
            names.push((tokens[1].substring(0, 1) == "_") ? tokens[1].substring(1) : tokens[1]);
            outpms.push("%" + i);
            i++;
        }
    }
    output = ReplaceSeveral(output, names, outpms);

    if (!output)
    {
        output = name + "(" + outpms.join(", ") + ")";
    }

    /*
    if (structname)
    {
        name += " (" + structname + ")";
        if (inputs.substring(0, inputs.indexOf(".")) == "e")
            inputs = "e.;" + structname + "." + structname + ";" + inputs.substring(3);
        else
            inputs = structname + "." + structname + ";" + inputs;
    }
    */

    let link = "";
    if (lastcomment && lastcomment.includes(" link="))
    {
        link = lastcomment.substring(lastcomment.indexOf(" link=") + " link=".length);
        lastcomment = lastcomment.substring(0, lastcomment.indexOf(" link="));
    }
    lastcomment = lastcomment.trim();

    let en = new editorNode((lastcomment ? MakeSafe(lastcomment) : name), (bCompact !== "None") ? bCompact : (bInput ? "3" : (bVoid ? "0" : "1")), output.replaceAll("\\n", "\n").replaceAll("\\t", "\t"), inputs + "o.;" + outputs, link, bTemporary);
    return en;
}

const eSettings = document.getElementById("editor_settings");

function AddSettings(contents)
{
    if (eSettings.innerHTML)
    {
        contents = "<br>" + contents;
    }
    eSettings.innerText += contents.replaceAll("\n", "<br>");
}

String.prototype.UnEscape = function() {
    return this.replaceAll("\\n", "\n").replaceAll("\\t", "\t").replaceAll("\.", ".");
}

const zLegend = document.getElementById("zLegend");

function CheckForKeywords(x)
{
    let bStatic = false;
    let bConst = false;
    let bInline = false;
    let bInput = false;
    let bStart = false;
    let bProgrammable = false;
    let tokens = x.split(" ");

    let typeoverride = "None";

    while (["static", "const", "inline", "input", "start", "compact", "programmable"].includes(tokens[0]))
    {
        switch(tokens[0])
        {
            case "static":
                bStatic = true;
                break;
            case "const":
                bConst = true;
                break;
            case "inline":
                bInline = true;
                break;
            case "input":
                bInput = true;
                break;
            case "start":
                bStart = true;
                break;
            case "programmable":
                bProgrammable = true;
            default:
                break;
        }
        tokens = tokens.slice(1);
    }

    if (tokens[0].substring(0, "_type".length) == "_type")
    {
        typeoverride = tokens[0].substring("_type".length);
        tokens = tokens.slice(1);
    }

    return [tokens.join(" "), bStatic, bConst, bInline, bInput, bStart, typeoverride, bProgrammable];
}

function UnCifyParameter(parameter_string)
{
    let that = parameter_string.split(" ");
    while (that.length > 2)
        that.splice(0, 2, that[0] + " " + that[1]);

    while (!"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz".includes(that[1][0]))
    {
        that[0] += that[1].substring(0, 1);
        that[1] = that[1].substring(1);
    }

    return that;
}

function CToNode(x, structname="")
{
    let bStatic = false;
    let bConst = false;
    let bInline = false;
    let bInput = false;
    let bStart = false;
    let bCompact = "None";
    let structbConst = false;
    let bProgrammable = false;
    
    [x, bStatic, bConst, bInline, bInput, bStart, bCompact, bProgrammable] = CheckForKeywords(x);

    if (bProgrammable && (bCompact == "None"))
    {
        bCompact = "5"
    }
    
    let tokens = x.split(" ");

    let rest, et, threshold, colortext, sname, contents;
    switch (tokens[0])
    {
        case "typedef":
            rest = x.substring(x.indexOf(" ") + 1).split(",");
            et = new editorType(rest);
            if (TypeExists(et.name))
            {
                console.log("Warning: ", et.name, " already defined, ignoring...");
                break;
            }
            editorTypes.push(et);
            threshold = 200;
            colortext = "white";
            if (et.input && et.icons[0])
            {
                Commands[1].nodes.push(new editorNode(et.name, "3", et.output, "i." + et.letter + ".;o.;" + et.letter + ".;", ""));
            }
            if (((parseInt(et.colour.substring(1, 3), 16) + (parseInt(et.colour.substring(3, 5), 16) * 2) + parseInt(et.colour.substring(5), 16)) * 0.3333) > threshold)
            {
                colortext = "black";
            }
            if (et.icons[0])
                zLegend.innerHTML += "<div class=\"col-6 editor_ltype\" style=\"" + "background-color: " + et.colour + ";\"><p style=\"color: " + colortext + ";\">" + et.name + "</p></div>";
            break;


        case "class":
        case "struct":
            tokens = tokens.slice(1).join(" ");
            sname = tokens.substring(0, tokens.indexOf("{")).trim();
            contents = tokens.substring(tokens.indexOf("{") + 1).trim();
            if (sname == "Settings")
            {
                AddSettings(contents.trim());
                break;
            }

            let propfmt = "%this.%name";
            let funcfmt = "%this.%name(%params)";
            let sbuffer = sname;
            let colour = "#FF0000";
            let props = "";
            let methods = "";
            for (let line of contents.split(";"))
            {
                line = line.trim()
                if (line && line != "}")
                {
                    [line, bStatic, structbConst, bInline, bInput, bStart] = CheckForKeywords(line);

                    if (["colour", "propfmt", "funcfmt"].includes(line.split(" ")[0]))
                    {
                        let setting = line.substring(line.indexOf("=") + 1).trim();
                        switch (line.split(" ")[0])
                        {
                            case "colour":
                                colour = setting;
                                break;
                            case "propfmt":
                                propfmt = setting;
                                break;
                            case "funcfmt":
                                funcfmt = setting;
                                break;
                        }
                        continue;
                    }

                    if (line.includes("("))
                    {
                        let et = StandardCLineToNode(line, bStatic, structbConst, bInline, bInput, false, sname, true)
                        methods += [et.name, et.io, et.link].join(", ") + "\n";
                    }
                    else
                    {
                        let type_name = UnCifyParameter(line);
                        props += [type_name[1].trim(), type_name[0].trim(), structbConst ? "r" : "rw", ""].join(", ") + "\n";
                    }
                }
            }
            sbuffer += "\n" + [colour, (bConst||bStatic).toString(), propfmt, funcfmt].join("\n") + "\n[\n\t" + Tabify(props, 1) + "\n]\n(\n" + Tabify(methods, 1) + ")\ndoc-link\n\n";
            ProcessStructBuffer(sbuffer);
            break;
        
        case "custom":
            Commands[bStart ? 0 : currentCategory].nodes.push(new editorNode(tokens.slice(1).join(" ").UnEscape().SmartSplit(",")));
            break;
        
        case "namespace":
            let name = x.substring("namespace ".length, x.indexOf("{"));
            let wholething = x.substring(x.indexOf("{") + 1).trim();
            currentCategory = GetNodeCategory(name.trim());
            LoadModuleFromHeaderFile(wholething);
            currentCategory = unsortedIndex;
            break;

        default:
            Commands[bStart ? 0 : currentCategory].nodes.push(StandardCLineToNode(tokens.join(" "), bStatic, bConst, bInline, bInput, bCompact, structname));
            break;
    }
    
}

function JSONToNub(obj, i)
{
    if (obj.constructor === String.constructor)
    {
        return obj + ";";
    }
    return GetTypeLetterFromName(obj[i]) + "." + i + ";";
}

function JSONToIO(obj)
{
    if (typeof obj === 'string')
    {
        return obj;
    }

    let inputs = "";
    let outputs = "";
    for (let i in obj.inputs)
        inputs += JSONToNub(obj.inputs, i);

    for (let i in obj.outputs)
        outputs += JSONToNub(obj.outputs, i);

    return inputs + "o.;" + outputs;
}

// Thanks to building the JavaScript module, I've realized how easy it would be to implement loading from JSON so here we go.
function LoadModuleFromJSON(text)
{
    let obj = JSON.parse(text);

    for (let i in obj.settings)
    {
        AddSettings(i + "=" + obj.settings[i] + "\n");
    }
    for (let i in obj.types)
    {
        et = new editorType(MakeSafe(i), obj.types[i].letter, obj.types[i].icon, obj.types[i]['connect-icon'], obj.types[i].colour, obj.types[i].format, obj.types[i].tag);
        editorTypes.push(et);
        threshold = 200;
        colortext = "white";
        if (et.input && et.icons[0])
        {
            Commands[1].nodes.push(new editorNode(et.name, "3", et.output, "i." + et.letter + ".;o.;" + et.letter + ".;", ""));
        }
        if (((parseInt(et.colour.substring(1, 3), 16) + (parseInt(et.colour.substring(3, 5), 16) * 2) + parseInt(et.colour.substring(5), 16)) * 0.3333) > threshold)
        {
            colortext = "black";
        }
        zLegend.innerHTML += "<div class=\"col-6 editor_ltype\" style=\"" + "background-color: " + et.colour + ";\"><p style=\"color: " + colortext + ";\">" + et.name + "</p></div>";
    }
    let structbuffer = "";
    let props, methods;
    for (let j in obj.structs)
    {
        let i = obj.structs[j];
        props = "[\n";
        for (let j in i.properties)
        {
            props += "\t" + [j, i.properties[j].type, i.properties[j].permissions, i.properties[j].link].join(", ") + "\n";
        }
        props += "]"
        methods = "(\n";
        for (let j in i.methods)
        {
            methods += "\t" + [j, JSONToIO(i.methods[j].io), i.methods[j].link].join(", ") + "\n";
        }
        methods += ")"
        structbuffer += [j, i.colour, i.static, i.propfmt, i.funcfmt, props, methods, i.link].join("\n") + "\n\n";
    }
    ProcessStructBuffer(structbuffer);

    let j;
    for (let i in obj.start)
    {
        j = obj.start[i];
        Commands[0].nodes.push(new editorNode(i, j.type, j.format, JSONToIO(j.io), j.link));
    }

    for (let i in obj.nodes)
    {
        j = obj.nodes[i];
        if (Array.isArray(j))
            Commands[unsortedIndex].nodes.push(new editorNode([MakeSafe(i)] + j));
        else if (typeof j === 'string')
            Commands[unsortedIndex].nodes.push(new editorNode((MakeSafe(i) + ", " + j).SmartSplit(",")));
        else
            Commands[unsortedIndex].nodes.push(new editorNode(MakeSafe(i), j.type, j.format, JSONToIO(j.io), j.link))
    }
}

function GetModIndex()
{
    return GetItem("editor_moduleindex");
}

function GetBModIndex()
{
    return GetItem("editor_bmoduleindex");
}

function SetModIndex(value)
{
    SetItem("editor_moduleindex", value);
}

function SetBModIndex(value)
{
    return SetItem("editor_bmoduleindex", value);
}

function GetModuleFromStorage(name)
{
    let modindex = GetModIndex()
    let sep = modindex ? "," : "";
    let index = GetBModIndex() + sep + modindex;
    if (index)
    {
        for (let i of index.split(","))
        {
            i = i.trim();
            if (i == name)
            {
                return localStorage.getItem(i);
            }
        }
    }
    return localStorage.getItem("javascript_module");
}

let modulestate = [];

function SaveModuleState()
{
    modulestate = [];
    for (i in GetBModIndex().split(","))
    {
        modulestate.push([i, GetModuleFromStorage(i)]);
    }
}

function LoadModuleFromUnknown(name)
{
    let format = name.substring(name.lastIndexOf("_") + 1);
    let contents = GetModuleFromStorage(name);
    switch (format)
    {
        case "module":
            LoadModuleFromText(contents);
            break;
        case "hmodule":
        case "modh":
        case "tsmodule":
            StartLoadModuleFromHeaderFile(contents);
            break;
        case "json":
            LoadModuleFromJSON(contents);
            break;
        default:
            ModuleLoadError("Unknown Module Type: " + name.substring(name.lastIndexOf("_") + 1) + "\n" + "Valid module types are .module, .hmodule, .tsmodule, or .json");
            return;
    }
}

var lastcomment = "";

function StartLoadModuleFromHeaderFile(text)
{
    currentCategory = unsortedIndex;
    LoadModuleFromHeaderFile(text);
}

function LoadModuleFromHeaderFile(text)
{
    //zLegend.innerHTML = "";
    let lines = text.split("\n");
    let buffer = "";
    let depth = 0;

    for (let line of lines)
    {
        line = line.trim();
        if (line.substring(0, 2) == "//" || line[0] == "#")
        {
            line = line.substring(0, line.indexOf("//"));
        }

        if (line.split(" ").includes("custom"))
        {
            CToNode(line);
            continue;
        }

        if (line.includes("{")) depth++;
        if (line.includes("}")) depth--;

        if (!depth)
        {
            for (let end of ";}")
            {
                if (line.includes(end))
                {
                    buffer += line.substring(0, line.indexOf(end));
                    if (line.substring(line.indexOf(end)).includes("//"))
                    {
                        lastcomment = line.substring(line.indexOf("//") + 2);
                        line = line.substring(0, line.indexOf("//"));
                    }
                    CToNode(buffer.trim());
                    buffer = "";
                    line = line.substring(line.indexOf(end) + 1);
                    break;
                }
            }
        }
        lastcomment = "";
        buffer += line + "\n";
    }
    RefreshLTypes();
}

function GetTypeOverrides()
{
    let overrides = GetItem("diazo_type_overrides");
    if (overrides)
    {
        return overrides.split(",,");
    }
    return [];
}

function SetTypeOverrides(overridesArray)
{
    SetItem("diazo_type_overrides", overridesArray.join(",,"));
}

function AddTypeColourOverride(typename, newcol)
{
    let overrides = GetTypeOverrides();
    for (let i = 0; i < overrides.length; i++)
    {
        if (overrides[i].split(",")[0] == typename)
        {
            overrides[i] = typename + "," + newcol;
            SetTypeOverrides(overrides);
            return;
        }
    }
    overrides.push(typename + "," + newcol);
    SetTypeOverrides(overrides);
}

function ImportTypeOverrides()
{
    AskForFile(async function() {
        if(this.files)
        {
            let t = await this.files[0].text();
            SetTypeOverrides(t.split(",,"));
        }
    });
}

function RemoveTypeOverride(typename)
{
    let overrides = GetTypeOverrides();
    for (let i = 0; i < overrides.length; i++)
    {
        if (overrides[i].split(",")[0] == typename)
        {
            overrides.splice(i, 1);
            SetTypeOverrides(overrides);
            return;
        }
    }
}

function DiscardTypeOverride(typename)
{
    let overrides = GetTypeOverrides();
    for (let i = 0; i < overrides.length; i++)
    {
        if (overrides[i].split(",")[0] == typename)
        {
            overrides[i] = typename + ",";
            SetTypeOverrides(overrides);
            return;
        }
    }
}

function LoadTypeOverrides()
{
    let overridenames = [];
    let toBeRemoved = [];
    for (let i of GetTypeOverrides())
    {
        let override = i.split(",");
        if (!override[1])
        {
            toBeRemoved.push(override[0]);
            overridenames.push(override[0]);
            continue;
        }
        overridenames.push(override[0]);
        ChangeTypeColour(override[0], override[1]);
    }

    for (let i of getById("zLegend").children)
    {
        for (let j of overridenames)
        {
            if (i.children[0].innerText == j)
            {
                OnChangeTypeColour(i);
                break;
            }
        }
    }

    for (let i of toBeRemoved)
    {
        RemoveTypeOverride(i);
    }
}

function ChangeTypeColour(typename, newcol)
{
    for (let i of editorTypes)
    {
        if (i.name == typename)
        {
            i.colour = newcol;
            break;
        }
    }
    AddTypeColourOverride(typename, newcol);
}

function SplitMerge(string, splitby)
{
    let split = string.split(splitby);
    let output = "";
    for (let i of split)
    {
        output += i;
    }
    return output;
}

function OnChangeTypeColour(legendElement)
{
    let typename = legendElement.children[0].innerText;
    let typecol = GetTypeFromName(typename).colour;
    legendElement.style['background-color'] = typecol;
    let toBeRespawned = [];
    for (let i of GetNodes())
    {
        let apinode = new NODEAPI_Node(i.id);
        if (apinode.node)
        {
            if (IOIncludesType(apinode.node.io, GetTypeLetterFromName(typename)))
            {
                toBeRespawned.push(i.id);
            }
        }
    }
    for (let i of toBeRespawned)
    {
        let apinode = new NODEAPI_Node(i);
        RespawnNode(getById(i), apinode, apinode.node);
    }
}

function RefreshLTypes()
{
    for (let i of document.getElementsByClassName("editor_ltype"))
    {
        i.oncontextmenu = function() {return false};
    }
    $(".editor_ltype").off('mouseup').on('mouseup', function(e) {
        e.preventDefault();
        switch (e.which)
        {
            case 1:
                SpawnNodeFromName(this.getElementsByTagName("p")[0].innerText, width / 2, height / 2);
                break;
            case 3:
                let thisVal = this;
                MakeGenericContextMenu(
                    [
                        [
                            "Change Colour",
                            function() {
                                TriggerModal(ChangeColModal, function(inputs) {
                                    let typename = thisVal.children[0].innerText;
                                    ChangeTypeColour(typename, inputs[0].value);
                                    OnChangeTypeColour(thisVal);
                                    /*
                                    let typename = thisVal.children[0].innerText;
                                    ChangeTypeColour(typename, inputs[0].value);
                                    thisVal.style['background-color'] = inputs[0].value;
                                    let toBeRespawned = [];
                                    for (let i of GetNodes())
                                    {
                                        let apinode = new NODEAPI_Node(i.id);
                                        if (apinode.node)
                                        {
                                            if (IOIncludesType(apinode.node.io, GetTypeLetterFromName(typename)))
                                            {
                                                toBeRespawned.push(i.id);
                                            }
                                        }
                                    }
                                    for (let i of toBeRespawned)
                                    {
                                        let apinode = new NODEAPI_Node(i);
                                        RespawnNode(getById(i), apinode, apinode.node);
                                    }
                                    */
                                });
                            }
                        ],
                        [
                            "Reset Colour",
                            function() {
                                    let typename = thisVal.children[0].innerText;
                                    DiscardTypeOverride(typename);
                                    location.reload();

                                    //OnChangeTypeColour(thisVal);
                                    /*
                                    let typename = thisVal.children[0].innerText;
                                    ChangeTypeColour(typename, inputs[0].value);
                                    thisVal.style['background-color'] = inputs[0].value;
                                    let toBeRespawned = [];
                                    for (let i of GetNodes())
                                    {
                                        let apinode = new NODEAPI_Node(i.id);
                                        if (apinode.node)
                                        {
                                            if (IOIncludesType(apinode.node.io, GetTypeLetterFromName(typename)))
                                            {
                                                toBeRespawned.push(i.id);
                                            }
                                        }
                                    }
                                    for (let i of toBeRespawned)
                                    {
                                        let apinode = new NODEAPI_Node(i);
                                        RespawnNode(getById(i), apinode, apinode.node);
                                    }
                                    */
                            }
                        ],
                    ],
                    e.clientX,
                    e.clientY
                );

            default:
                break;
        }
    });
}

function SpawnNodeFromName(name, x, y)
{
    for (let group of Commands)
    {
        for (let node of group.nodes)
        {
            if (node.name == name)
            {
                ProcSpawnNode(node, x, y);
                break;
            }
        }
    }
}

function GetNodeCategory(categoryname)
{
    for (let i = 0; i < Commands.length; i++)
    {
        if (Commands[i].name == categoryname)
            return i;
    }
    return Commands.push(new editorNodeGroup(categoryname, [])) - 1;
}

let currentCategory = unsortedIndex;
const bgBrightThreshold = 200;


function LoadModuleFromText(text)
{
    zLegend.innerHTML = "";
    let lines = text.replaceAll("\r\n", "\n").split("\n");
    let mode = 0;
    let splt;
    let structbuffer = "";
    let trimmed;
    currentCategory = unsortedIndex;

    try
    {
        for (let l = 0; l < lines.length; l++)
        {
            trimmed = lines[l].trim().replaceAll("\\n", "\n").replaceAll("\\t", "\t");
            if (mode != 3)
            {
                if (trimmed == "" || "/**//".includes(trimmed.substring(0, 2)))
                    continue;
            }
                
        
            switch (trimmed)
            {
                    case "StartingNodes:":
                        ProcessStructBuffer(structbuffer);
                        mode = 2;
                        break;
                    case "Nodes:":
                        mode = 1;
                        break;
                    case "Structs:":
                        mode = 3;
                        break;

                    case "Types:":
                        mode = 0;
                        break;

                    case "Settings:":
                        mode = 4;
                        break;

                    default:
                        if (trimmed.length >= "Category:".length)
                        {
                            if (trimmed.substring(0, "Category:".length) == "Category:")
                            {
                                currentCategory = GetNodeCategory(trimmed.substring("Category:".length).trim());
                                break;
                            }
                        }

                        splt = trimmed.SmartSplit(",");
                        switch (mode)
                        {
                            case 0:
                                let et = new editorType(splt);
                                editorTypes.push(et);

                                splt[3] = splt[3].trim();

                                let colortext = "white";
                                if (((parseInt(et.colour.substring(1, 3), 16) + (parseInt(et.colour.substring(3, 5), 16) * 2) + parseInt(et.colour.substring(5), 16)) * 0.3333) > bgBrightThreshold)
                                    colortext = "black";

                                if (et.icons[0])
                                {
                                    zLegend.innerHTML += "<div class=\"col-6 editor_ltype\" style=\"" + "background-color: " + et.colour + ";\"><p style=\"color: " + colortext + ";\">" + et.name + "</p></div>";

                                    if (et.input)
                                        Commands[1].nodes.push(new editorNode(et.name, "3", et.output, "i." + et.letter + ".;o.;" + et.letter + ".;", ""));
                                }
                                break;

                            case 1:
                                Commands[currentCategory].nodes.push(new editorNode(splt));
                                break;
                            case 2:
                                Commands[0].nodes.push(new editorNode(splt));
                                break;
                            case 3:
                                structbuffer += lines[l] + "\n";
                                break;
                            case 4:
                                // I have no idea why, but the browser is inserting end tags for me when I specifically don't want them.
                                // It's probably a convenience thing but in my case it's causing bugs.
                                eSettings.innerText += lines[l] + "<br>";
                                break;

                            default:
                                break;

                        }
                        break;
            }
        }
        RefreshLTypes();
    }
    catch(err)
    {
        console.log(err);
    }

}

function SetItem(item, value)
{
    localStorage.setItem(item, value);
}

function GetItem(item)
{
    let val = localStorage.getItem(item);
    if (val === null)
        return "";
    return val;
}

function ClearModules()
{
    for (let i of GetModIndex().split(","))
    {
        SetItem(i, "");
    }
    SetModIndex("");
}


function FindCommand(command)
{
    for (let g of Commands)
    {
        for (let c of g.nodes)
        {
            if (c.name == command)
            {
                return c;
            }
        }
    }
    for (let c of functionNodes)
    {
        if (c.name == command)
        {
            return c;
        }
    }
    MakeBasicDialog("Conversion Error", "FindCommand: Unknown name: " + command);
    return -1;
}

$("#editor_previewsel").click(FetchNodeCode);

$("#editor_previewall").click(function() {
    existing_vars = [];
    outputWindow.innerText = ConvertAll();
});

$("#copyresult").click(function() {
    navigator.clipboard.writeText(outputWindow.innerText);
    MakeCustomDialog("", "Copied to clipboard!", ["Ok"], function() {});
});

Number.prototype.ToRGB = function(alpha=255)
{
    return "#" + this.toString(16).padStart(6, "0") + alpha.toString(16).padStart(2, "0");
}

function FunctionReplace(func, nodes)
{
    while (func.includes("%") && nodes.length)
    {
        // Function Level / Right Side
        func = func.replace("%", $("#" + nodes[0]).attr("zw-link"));
        nodes.pop(0);
    }
    return func.substr(1);
}

function genId(length){
    var chart = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    var output = "";
    var temp = 0;
    for(let n = 0; n < length; n += 1){
        temp = Math.floor(Math.random() * chart.length - 1);
        output += chart.substring(temp, temp + 1);
    }
    return output;
}

function RestoreStoredValues()
{
    let inputs = document.getElementsByClassName("editor_input");
    for (let i = 0; i < inputs.length; i++)
    {
        if (inputs[i])
        {
            if (inputs[i].getAttribute("type") === "checkbox")
                inputs[i].checked = inputs[i].getAttribute("z-stored-value");

            inputs[i].value = inputs[i].getAttribute("z-stored-value");
        }
    }
}

function StoreValues()
{
    for (let i of document.getElementsByClassName("editor_input"))
    {
        if (i.getAttribute("type") === "checkbox")
        {
            i.value = GetSetting("bools").split("|")[i.checked ? 0 : 1];
        }
        i.setAttribute("z-stored-value", i.value);
    }
}

var rememberedSearch = "";

function OnTick()
{
    if (window.innerWidth != acanvas.getAttribute("width"))
    {
        width = window.innerWidth;
        height = window.innerHeight;
        acanvas.setAttribute("width", width);
        acanvas.setAttribute("height", height);
        bcanvas.setAttribute("width", width);
        bcanvas.setAttribute("height", height);
        actx.lineWidth = 3;
        lctx.lineWidth = 3;
        UpdateStaticLines();
    }

    if (rememberedSearch !== searchBox.val())
    {
        CommandSearch();
    }
    rememberedSearch = searchBox.val();
}

var tick;
const tickInterval = 250;

function StartTick()
{
    tick = setInterval(OnTick, tickInterval);
}

function GetSetting(name)
{
    let properties = eSettings.innerText.split("<br>");
    for (let p of properties)
    {
        if (p.substring(0, p.indexOf("=")) == name)
        {
            return p.substring(p.indexOf("=") + 1);
        }
    }
    return "";
}

let existing_vars = [];

function MakeAssign(name, type, val, is_var=false)
{
    if (is_var)
    {
        if (!existing_vars.includes(name)) {
            existing_vars.push(name);
            return GetSetting("decl-sign").replaceAll("%name", MakeVariableName(name)).replaceAll("%type", type).replaceAll("%val", val);
        }
    }

    return GetSetting("var-sign").replaceAll("%name", name).replaceAll("%type", type).replaceAll("%val", val);
}

function MakeDeclarationAssign(name, type, val)
{
    return GetSetting("decl-sign").replaceAll("%name", name).replaceAll("%type", type).replaceAll("%val", val);
}

function ColourOperation(colour, operation)
{
    let string = colour.toString(16).padStart(6, "0");
    let r = parseInt(string.substring(0, 2), 16);
    let g = parseInt(string.substring(2, 4), 16);
    let b = parseInt(string.substring(4, 6), 16);
    r = operation(r);
    b = operation(b);
    g = operation(g);
    return (r << 16) | (g << 8) | b;
}

function RestoreInputs()
{
    RestoreStoredValues();
    StartTick();
}

const outerblur = "100px";
const outerblurdist = "50px";
const outerblurstrength = 0.5;
const outerbluralpha = 50;

function BoxShadowFromGradients(grads, code)
{
    let stle = "";
    switch (GetPanelSetting("Glow"))
    {
        case "On":
            // The lighting is achieved with a very blurry shadow that glows
            if (code.split("o.;")[1])
            {
                stle += outerblurdist + " " + outerblurdist + " " + outerblur + " " + ColourOperation(grads[1], function(a) { return Math.round(a * outerblurstrength);}).ToRGB(outerbluralpha) + ", ";
            }
            if (code.split("o.;")[0])
            {
                stle += "-" + outerblurdist + " " + outerblurdist + " " + outerblur + " " + ColourOperation(grads[0], function(a) { return Math.round(a * outerblurstrength);}).ToRGB(outerbluralpha) + ", ";
            }
        default:
            return stle + "inset var(--grStrN) 0px 15px " + grads[1].ToRGB() + ", inset var(--grStr) 0px 15px " + grads[0].ToRGB() + ", inset 0px var(--grStrN) 5px " + grads[2].ToRGB() + ";";
    }
}

let reservedvars = 0;

function MakeNub(type, id, zval, icons=undefined, subClass="", defaultValue="")
{
    if (icons === undefined)
    {
        icons = type.icons;
    }
    if (type.type == "bptype")
    {
        return ""
    }

    return "<button class=\"nub editor_hint " + subClass + "\" hint-desc=\"" + type.name + (defaultValue ? ("<br>Default&#58; " + defaultValue) : "") + "\" hint-title=\"\" style=\"color: " + type.colour + "\"><i id=\"" + id  + "\" z-val=\"" + zval + "\" zw-type=\"" + type.letter + "\" class=\"nubIcon fa fa-2x fa-" + icons[0] + "\" ></i></button>";
}

function RemoveEdgeBrackets(string)
{
    let startbrackets = "[({";
    let endbrackets = "])}";
    for (let i = 0; i < startbrackets.length; i++)
    {
        if (string[0] == startbrackets[i] && string[string.length - 1] == endbrackets[i])
            return string = string.substring(1, string.length - 1);
    }
    
    return string;
}

function SpawnFunctionNodes(name)
{
    ProcSpawnNode(functionStartNode)
}



function ProcSpawnNubs(node, name, nodeId, isCompact, nubSubClass)
{
    let out = false;
    let suffix = "";
    let c;
    let zval = "";
    let num = 0;
    let io = node.io;
    let padding = isCompact ? "3" : "4";
    let leftcol = "7";
    let rightcol = "5";
    let defaultValue = "";
    if (isCompact)
    {
        leftcol = "3";
        rightcol = "3";
    }
    let endtag = isCompact ? "" : "</div>";

    let addition = endtag + "<div class=\"row px-0 py-" + padding + "\"><div class=\"col-" + leftcol + " mx-auto p-0 text-left my-auto\"><div class=\"container-fluid\">";

    function MakePaddingContainer(extraClass)
    {
        //if (isCompact) return "";
        return "<div class=\"col-1 p-0 " + (isCompact ? "" : extraClass) + "\"><br></div>";
    }

    function MakeNubText(name, col="8")
    {
        if (isCompact) return "";
        return "<div class=\"col-" + col + " p-0 my-auto\"><nubtext>" + name + "</nubtext></div>";
    }

    function MakeNubContainer(type, id, zval, icons, subClass, defaultValue)
    {
        return "<div class=\"col-" + (isCompact ? "11" : "3") + " text-center p-0 my-auto\">" + MakeNub(type, id, zval, icons, subClass, defaultValue) + "</div>";
    }

    while (io.includes(';'))
    {
        defaultValue = "";
        suffix = "";
        c = io.substring(0, io.indexOf(';')).SmartSplit(".");
        if (c[0] == 'o')
        {
            out = true;
            if (io.split("o.;")[0])
            {
                addition = addition.substring(0, addition.length - 4);
            }
            num = 0;

            if (isCompact)
            {
                addition += "</div></div><div class=\"col-6 text-center p-0 my-auto grabbable\" id=\"" + nodeId + "top\"><div class=\"container-fluid p-0\"><nodetitle";
                if (node.type == 4)
                {
                    addition += " class=\"\" node-pointer=\"" + MakeSafe(name) + "\">";
                    name = name.substring(name.indexOf("(") + 1, name.indexOf(")"));
                }
                else
                    addition += ">";

                addition += name + "</nodetitle>";
            }
            addition += "</div></div><div class=\"col-" + rightcol + " text-right mx-auto p-0 my-auto\"><div class=\"container-fluid " + (isCompact ? "p-0" : "pl-0") + "\">";
            io = io.substring(io.indexOf(';') + 1);
            continue;
        }

        let t = GetTypeFromLetter(c[c.length - 2]);
        let icons = [];
        if (t)
            icons = t.icons.slice(0);
        zval = "";

        if (c.length > 2)
        {
            switch (c[0])
            {
                // prefixing with n. means to add to the lighting and gradient, but don't actually spawn a nub
                case 'n':
                    addition += "<br>";
                    num++;
                    io = io.substring(io.indexOf(';') + 1);
                    continue;

                // prefixing with i. means instead of a nub, use the input tag for that type
                case 'i':
                    if ((c[c.length - 2] == "diazo_type") || t.input.includes("|"))
                    {
                        let options = t.input.split("|");
                        if (c[c.length - 2] == "diazo_type")
                        {
                            options = MakeTypeOptions();
                        }
                        addition += "<div class=\"row p-0\"><div class=\"col-1 p-0 pr-2\"></div><div class=\"col-7 p-0\">" + MakeDropdown(options, options[0], nodeId + "-in" + num, "editor_genericdropdown", "editor_input") + "</div><div class=\"col-4 px-2\"> " + c[c.length - 1] + "</div></div>";
                    }
                    else
                        addition += "<div class=\"row p-0\"><div class=\"col-1 p-0 pr-2\"></div><div class=\"col-7 p-0\"><input id=\"" + nodeId + "-in" + num + "\" class=\"editor_input w-100\" type=\"" + t.input + "\"></div><div class=\"col-4 px-2\"> " + c[c.length - 1] + "</div></div>";
                    io = io.substring(io.indexOf(';') + 1);
                    num++;
                    continue;

                // prefixing with p. means it's an optional parameter
                // It needs a default value, so it's structured p.default.type.name;
                case 'p':
                    icons[0] = "question";
                    c = c.slice(1);
                    defaultValue = c[0];
                    break;

                // prefixing with r. tells the editor to reserve a variable, and that nub will output the reserved variable's name.
                // to reference the reserved variable in the node, use %n in the format.
                case 'r':
                    zval = "\" diazo_reservedvariable=\"z";
                    break;

                // c. means to just insert the name as is, to make a custom nub
                case 'c':
                    addition += c[c.length - 1] + "<br>";
                    num++;
                    io = io.substring(io.indexOf(';') + 1);
                    continue;

                // v. allows you to overwrite the format that a nub uses, instead of using the node's format.
                case 'v':
                    zval = RemoveEdgeBrackets(c[1]);
                    c = c.slice(1);
                    break;

                // prefixing with a. means there will be a + button to add more input nubs, they will be combined into a single string separated by commas.
                case 'a':
                    zval = "EDITORARRAY";
                    //addition += "<div class=\"row\">";
                    //addition += MakePaddingContainer("pr-2") + MakeNubContainer(t, nodeId + "-in" + num, zval, icons, nubSubClass, defaultValue) + MakeNubText(c[2], "3") + "<div class=\"col-5 p-0\"><button type=\"button\" id=\"" + num  + "\" class=\"btn btn-bloop editor_addNub\">+</button></div>";
                    suffix = "<div class=\"row\"><div class=\"col-12\"><button type=\"button\" id=\"" + num  + "\" class=\"btn btn-bloop editor_addNub btn-block\">+</button></div></div>";
                    //addition += "</div>";
                    //num++;
                    //io = io.substring(io.indexOf(';') + 1);
                    break;

            }   
            c = c.slice(1);
        }

        addition += "<div class=\"row\">";
        if (!out)
        {
            addition += MakePaddingContainer("pr-2") + MakeNubContainer(t, nodeId + "-in" + num, zval, icons, nubSubClass, defaultValue) + MakeNubText(c[1]);
        }
        else
            addition += MakeNubText(c[1]) + MakeNubContainer(t, nodeId + "-out" + num, zval, icons, nubSubClass, defaultValue) + MakePaddingContainer("pl-2");

        addition += "</div>" + suffix;

        num++;
        io = io.substring(io.indexOf(';') + 1);
    }
    return addition.substring(0, addition.length - 4) + "</div></div></div>";
}

function MakeUniqueId(name)
{
    function CreateRandomId()
    {
        return Math.floor(Math.random() * 65535);
    }

    let newid = CreateRandomId();
    while ($("#" + name + newid).length)
        newid = CreateRandomId();

    return newid;
}

HTMLElement.prototype.lastElementByClassName = function(classname) {
    let es = this.getElementsByClassName(classname);
    return es[es.length - 1];
}

function SpawnComment(x, y, width, height)
{
    StoreValues();
    let commentid = MakeUniqueId("diazo-comment");
    graph.innerHTML += "<div id=\"" + commentid + "\" class=\"container diazo-comment " + draggableClass + "\" style=\"top: " + y + "px; left: " + x + "px;\"><div id=\"" + commentid + "top\" class=\"row diazo-comment-header grabbable\"><div class=\"col-12 py-2\"></div></div><div class=\"row p-0 diazo-comment-content\"><textarea class=\"editor_input diazo-comment-input w-100 text-white\" value=\"TODO: \"></textarea><div class=\"col-12\"></div></div></div>";
    RestoreStoredValues();
    refreshGraph();
    graph.lastElementByClassName("diazo-comment-input").focus();
}

// SPAWNING NODES
function ProcSpawnNode(node, x, y, nodeSubClass="", nubSubClass="", newid="", notafunction=false)
{
    let name = node.name.substring(0);
    let code = node.io;
    let t;

    if (!notafunction)
    {
        if (node.type == "8")
        {
            t = node.io.split("o.;");
            node.io = t[0].substring(3) + "o.;" + t[1].substring(3);
        }
    }

    let link = node.link;
    let safename = node.id;
    let grads = GradientsFromCode(node.io);
    let stle = "box-shadow:";

    stle += BoxShadowFromGradients(grads, code) +  "top: " + y + "px; left: " + x + "px";

    let nodeId = safename + MakeUniqueId(safename);

    let nodetype = node.type;

    let nodestyle = GetPanelSetting("Operator Node Style");

    if ((nodetype == 4) && (nodestyle !== "Symbol Only"))
    {
        switch (nodestyle)
        {
            case "Full Title":
                nodetype = "2";
                break;
            case "Full Node":
                nodetype = "1";
                break;
        }
    }

    let isCompact = ["2", "4"].includes(nodetype);

    if (isCompact) nodeSubClass += " w-225";

    let addition = "<div class=\"container zw-Node " + draggableClass + " " + nodeSubClass + "\" id=\"" + nodeId + "\" style=\"" + stle + "\">"

    if (!isCompact)
    {
        addition += "<div class=\"row editorNodeTop\" id=\"" + nodeId + "top\">";
        if (link)
        {
            addition += "<div class=\"col-2 p-0\"></div><div class=\"col-8 p-0\"><nodetitle>" + name + "</nodetitle></div>";
            addition += "<div class=\"col-2 p-0 my-auto\">";
            addition += "<a href='" + GetSetting("doc-link") + link + "' target='_blank'><i class='fa fa-question-circle'></i></a>";
        }
        else
            addition += "<div class=\"col-12\"><nodetitle>" + name + "</nodetitle>";

        addition += "</div>"
    }

    let oldtype = node.type;
    node.type = nodetype;
    addition += ProcSpawnNubs(node, name, nodeId, isCompact, nubSubClass);
    node.type = oldtype;
    node.io = code;

    addition += "</div>";

    AddToGraph(addition);
    HideContext();
}

function AddToGraph(html)
{
    StoreValues();
    graph.innerHTML += html;
    RestoreStoredValues();
    refreshGraph();
    UpdateGenericDropdowns();
    UpdateClickables();
}

var zTypes = [

];

var zCols = [

];

var zLetterCodes = [

];

function GradientsFromCode(code)
{
    let codes = code.split("o.;");
    var count = 0;
    let c1 = c2 = c3 = s1 = s2 = s3 = 0;
    function Average(item)
    {
        if (item !== "")
        {
            splt = item.split(".")
            let l = splt.length;
            s1 += parseInt(NodeColourFromLetter(splt[l-2]).substring(1, 3), 16);
            s2 += parseInt(NodeColourFromLetter(splt[l-2]).substring(3, 5), 16);
            s3 += parseInt(NodeColourFromLetter(splt[l-2]).substring(5), 16);
            count++;
        }
    }
    if (codes[0])
    {
        let ins = codes[0].split(";");
        ins.forEach(Average);
        s1 /= count;
        s2 /= count;
        s3 /= count;
        c1 = (s1 << 16) | (s2 << 8) | s3;
    }

    if (codes[1])
    {
        let outs = codes[1].split(";");
        s1 = s2 = s3 = count = 0;
        outs.forEach(Average);
        s1 /= count;
        s2 /= count;
        s3 /= count;
        c2 = (s1 << 16) | (s2 << 8) | s3;
        c3 = Math.floor((c1 + c2) * 0.5);
    }
    return [c1, c2, c3];
}

let doubleclicktimer = 0;

function StopHint()
{
    if (bhintwait)
    {
        clearTimeout(hinttimeout);
        bhintwait = false;
        return;
    }

    HideHint();
}

function UpdateClickables()
{
    $(".editor_addNub").off().on('click', function() {
        let nubs = this.parentElement.parentElement.parentElement.getElementsByClassName("nubIcon");
        let nub = nubs[nubs.length - 1];
        this.parentElement.parentElement.previousElementSibling.insertAdjacentHTML("beforeend", "<div class=\"col-1 p-0 pr-2\"></div><div class=\"col-3 text-center p-0 my-auto\">" + MakeNub(GetTypeFromLetter(nub.getAttribute("zw-type")), nub.id.substring(0, nub.id.indexOf("-") + 3) + (parseInt(nub.id.substring(nub.id.indexOf("-") + 3)) + 1), "") + "</div><div class=\"col-8 p-0 my-auto\"></div>");
        refreshGraph();
        UpdateClickables();
        UpdateStaticLines();
    });

    $(".editor_hint").off('mouseenter').on('mouseenter', function(e) {
        hinttimeout = setTimeout(ShowHint, 500, ((e.clientX > (width / 2)) ? e.clientX - 250 - hintspacing : e.clientX + hintspacing), e.clientY - 100, this.getAttribute("hint-title"), this.getAttribute("hint-desc"));
        bhintwait = true;
    });
    
    $(".editor_hint").off('mouseleave').on('mouseleave', function() {
        StopHint();
    });

    OnOnce($("nubtext"), 'click', function() {

        if ((Date.now() - doubleclicktimer) < 250)
        {
            // Man aren't containers great
            let thisnode = this.parentElement.parentElement.parentElement.parentElement.parentElement.parentElement;
            let isfunc = InFunction() && [GetNodes()[0], GetNodes()[1]].includes(thisnode) && IsFunctionNode(currentDocument);

            if (!isfunc)
                isfunc = IsFunctionNode(GetNodeTitle(thisnode));

            if (!this.getAttribute("editing") && isfunc)
            {
                this.innerHTML = "<input type=\"text\" id=\"texteditinginput\" value=\"" + this.innerText + "\">";

                $("#texteditinginput").focus();

                // Chicken and egg scenario so it has to try both
                let nubdex = "";
                try {
                    nubdex = this.parentElement.nextSibling.childNodes[0].childNodes[0].id;
                }
                catch {
                    nubdex = this.parentElement.previousSibling.childNodes[0].childNodes[0].id;
                }

                let nubisout = GetNubIsOut(nubdex) ? 1 : 0;
                nubdex = parseInt(nubdex.substring(nubdex.length - 1));
                if (InFunction()) nubisout = 1 - nubisout;
                let thisVal = this;
                OnOnce($("#texteditinginput"), 'focusout', function() {
                    if (!this.value)
                    {
                        RemoveFunctionNub(isfunc.name, nubisout, nubdex);
                        RefreshFunctionNodes();
                        refreshGraph();
                        UpdateClickables();
                    }
                    else
                    {
                        let nubs = isfunc.io.split("o.;");
                        let nubside = nubs[nubisout].split(";");
                        let attributes = nubside[nubdex].split(".");
                        UpdateFunctionIO(isfunc.name, nubisout, nubdex, attributes.toSpliced(attributes.length - 1, 1, this.value).toSpliced(1, 1, "[" + GetSetting("param-format").replace("%name", this.value) + "]").join("."));
                        thisVal.innerHTML = this.value;
                        thisVal.setAttribute("editing", "");
                        if (InFunction())
                            RefreshFunctionNodes();
                        refreshGraph();
                        UpdateClickables();
                    }
                    UpdateStaticLines();
                    SaveFunctions();
                });
                this.setAttribute("editing", "true");
            }
        }
        doubleclicktimer = Date.now();
    });

    $(".editor_input").off('change').on('change', function() {
        SaveDocument();
    });

    RefreshLTypes();
    UpdateGenericDropdowns();
}

// DRAGGABLE ELEMENTS

function BeginGetNodeCode(element)
{
    reservedvars = 0;
    existing_vars = [];
    collapsedNubs = [];
    collapsedNubNames = [];
    outputWindow.innerText += ConvertSelected();
}

function FetchNodeCode()
{
    outputWindow.innerText = "";
    BeginGetNodeCode();
}

function DeselectAll()
{
    $(".editor_selected").removeClass("editor_selected");
}

function PositionFromId(id){
    var output = $("#" + id).attr('style');
    if (output != undefined)
        output = output.substring(output.indexOf("left:") + 6, output.indexOf("px", output.indexOf("left:")));

    return parseInt(output);
}

function NodeFromId(id)
{
    return document.getElementById(id.substring(0, id.indexOf("-")));
}

function GetPositionOfNode(elem)
{
    let output = [0, 0];
    let pos = elem.getBoundingClientRect();
    output[0] = pos.x + (pos.width / 2);
    output[1] = pos.y + (pos.height / 2);
    return output;
}

function GetNubIsOut(id)
{
    let index = id.lastIndexOf("-") + 1;
    return id.substring(index, index + 3) == 'out';
}

function ElementPos(elem)
{
    return [parseInt(elem.style.left.substring(0, elem.style.left.length - 2)), parseInt(elem.style.top.substring(0, elem.style.top.length - 2))]
}

function NodeColourFromLetter(letter)
{
    let t = GetTypeFromLetter(letter);
    if (t)
        return t.colour;

    return "#000";
}

function GetNodeElementInputs(elem)
{
    elem.getElementsByClassName("hello");
}

function IOIncludesType(io, type, strict=false)
{
    let items = SplitMerge(io, "o.;").split(";");
    let nubType;
    for (let i of items)
    {
        nubType = i.split(".");
        nubType = nubType[nubType.length - 2];
        if ((nubType == type) || (!strict && (nubType == 'g' && type != "e")))
        {
            return true;
        }
    }
    return false;
}

function GetValidCommandBtns(nodes, filtering=true)
{
    let search = MakeSafe(searchBox.val().toLowerCase());
    let result = "";
    let inputs = "";
    let outputs = "";
    let mode = false;
    let temp = "";
    let s;
    let icon;
    let letter;
    let t;
    for (let cmd of nodes)
    {
        if (filtering)
        {
            if (search.trim() !== "")
            {
                temp = cmd.name.toLowerCase()
                if (!temp.includes(search) && !temp.replaceAll(" ", "").includes(search)) continue;
            }

            if (selectedType)
            {
                if (!cmd.io || !IOIncludesType(cmd.io.split("o.;")[(isOut ? 0 : 1)], selectedType, ctxSensitive))
                    continue;
            }
        }


        inputs = "";
        outputs = "";
        mode = false;

        let io = cmd.io.split("o.;");
        if (cmd.type == "8")
        {
            io[0] = io[0].substring(3);
            io[1] = io[1].substring(3);
        }

        for (let put of io.join("o.;").SmartSplit(";"))
        {
            put = put.trim();
            if (put === "") break;

            if (put === "o.")
            {
                mode = true;
                continue;
            }
            s = put.SmartSplit(".");
            if (s.length < 2) debugger;
            letter = s[s.length - 2].trim();
            if (letter == 'diazo_type') continue;
            t = GetTypeFromLetter(letter);

            if (!t)
            {
                ModuleLoadError("Unknown type: " + letter + "\nOn Node: " + cmd.name + ", " + cmd.io);
            }

            icon = t.icons[0];
            let modifiers = s.slice(0, s.length - 2);
            if (modifiers.includes("p")) icon = "question";

            if (modifiers.includes('n') || modifiers.includes('i')) continue

            let nub = "<button class=\"nub editor_hint\" hint-title=\"\" hint-desc=\"" + t.name + "\" style=\"color: " + t.colour + "\"><i class=\"fa fa-" + icon + "\"></i></button>";

            if (mode)
                outputs += nub;
            else
                inputs += nub;

        }
        result += "<div class=\"row py-3 contextItem cmdBtn\"><div class=\"col-2 m-auto\">" + inputs + "</div><div class=\"col-8 text-center m-auto\"><sometext class=\"px-5\">" + cmd.name + "</sometext></div><div class=\"col-2 my-auto\">" + outputs + "</div></div>";
    }
    return result;
}

function RefreshCmdBtns()
{
    OnOnce($(".cmdBtn"), 'click', function () {
        let fnc;
        let that = this.getElementsByTagName("sometext")[0];

        if (that)
        {
            if (that.innerText == "Add Comment...")
            {
                ResetSelected();
                SpawnComment(commandSpawnPoint.x, commandSpawnPoint.y);
                HideContext();
                return;
            }
            else if (that.innerText == "Make Variable...")
            {
                if (selectedType && (selectedType != "e"))
                {
                    TriggerModal(new editor_modal("Make Variable", [["Name", "", "text"]]), function(inputs) {
                        AddEditorVariable([{value: inputs[0].value}, {innerHTML: selectedType}]);
                        ProcSpawnNode(Commands[unsortedIndex].nodes[Commands[unsortedIndex].nodes.length - (isOut ? 1 : 2)], commandSpawnPoint.x + 100, commandSpawnPoint.y - 100);
                        let apinode = new NODEAPI_Node(GetLastSpawnedNode().id)
                        if (isOut)
                            LinkNubs(apinode.GetInputs()[1].element);
                        else
                            LinkNubs(apinode.GetOutputs()[0].element);
                    });
                }
                HideContext();
                return;
            }
        }

        if (this.getAttribute("cmdval"))
            fnc = FindCommand(this.getAttribute("cmdval"));
        else
            fnc = FindCommand(that.innerHTML);

        ProcSpawnNode(fnc, commandSpawnPoint.x + 100, commandSpawnPoint.y - 100);

        let linked = false;
        if (selectedType !== null && (selectedType == 'g' || fnc.io.split("o.;")[0].includes(selectedType + ".") || fnc.io.split("o.;")[0].includes("g.")))
        {
            // Connect the two together
            let spawnedNode = document.getElementsByClassName("zw-Node");
            spawnedNode = spawnedNode[spawnedNode.length - 1];
            let oppositePuts = fnc.io.split("o.;")[isOut ? 0 : 1].split(";");
            let apinode = new NODEAPI_Node(spawnedNode.id);
            let oppositeNubs = isOut ? apinode.GetInputs() : apinode.GetOutputs();

            for (let i = 0; i < oppositePuts.length; i++)
            {
                let candidate = oppositePuts[i];
                if ((selectedType == 'g' && candidate.substring(0, 1) !== 'e') || candidate.substring(0, selectedType.length) == selectedType || (candidate.substring(0, 1) == 'g' && selectedType !== 'e'))
                {
                    if (LinkNubs(oppositeNubs[i].element))
                    {
                        linked = true;
                        break;
                    }
                }
            }
        }

        if (!linked)
            ResetSelected();
        else
        {
            FixAllConnections();
            UpdateStaticLines();
        }
        selectedType = null;

        HideContext();
    });
}

function CompareString(string2)
{
    let string1 = searchBox.val().toLowerCase();
    string2 = string2.toLowerCase();
    if (string2.includes("("))
        string2 = string2.substring(0, string2.indexOf("("));

    let v = Math.abs(string1.length - string2.length);
    let end = Math.min(string1.length, string2.length);

    for (let i = 0; i < end; i++)
    {
        if (string1[i] != string2[i]) break;
        v--;
    }

    return v;
}

function EditElement(element)
{
    let parent = element.parentElement;
    let nextelem = element.nextSibling;
    let input = document.createElement("input");
    input.value = element.innerHTML;

    parent.removeChild(element);
    parent.insertBefore(input, nextelem);

    input.addEventListener("change", function() {
        parent.removeChild(this);
        parent.insertBefore()
    })
}

function CommandSearch()
{
    let fullHTML = "";
    fullHTML += GetValidCommandBtns((selectedType && (selectedType != 'e')) ? [new editorNode("Add Comment...", "", "", "", "", true), new editorNode("Make Variable...", "", "", "", "", true)] : [new editorNode("Add Comment...", "", "", "", "", true)], false);

    if (searchBox.val())
    {
        const sortedNodes = [];

        for (const command of Commands.slice(1))
            sortedNodes.push(...command.nodes);

        sortedNodes.push(...functionNodes);

        sortedNodes.sort(function(a, b) {
            return CompareString(a.name) - CompareString(b.name);
        });

        fullHTML += GetValidCommandBtns(sortedNodes);
    }
    else
    {
        fullHTML += GetValidCommandBtns(Commands[1].nodes);
        fullHTML += GetValidCommandBtns(Commands[unsortedIndex].nodes);

        for (let cmd of Commands.slice(unsortedIndex + 1))
        {
            fullHTML += "<button type=\"button\" class=\"row py-2 text-right contextItem cmdDrop text-themed\"><div class=\"col-2\"></div><div class=\"col-8\"><sometext class=\"btn btn-block px-5 text-themed\">" + cmd.name + "</sometext></div><div class=\"col-2 text-center\"><i class=\"fa fa-caret-square-o-down\"></i></div></button>";
            if (selectedType === cmd.name || searchBox.val().length > 2 || ctxSensitive.checked)
                fullHTML += GetValidCommandBtns(cmd.nodes);

            fullHTML += "</div></div>";
        }
    }

    $("#contextGeneric").html(fullHTML);
    RefreshCmdBtns();
    UpdateClickables();
    $(".cmdDrop").off().on('click', function () {
        if (this.value !== 'true')
        {
            for (const group of Commands.slice(1))
            {
                if (group.name === this.getElementsByTagName("sometext")[0].innerHTML)
                    this.insertAdjacentHTML("afterend", GetValidCommandBtns(group.nodes))
            }
            RefreshCmdBtns();
            this.value = 'true';
        }
    });
    if ($("#contextGeneric").html() === "")
    {
        $("#contextGeneric").html("<p>Nothing was found...</p>")
    }
}

$("#contextSensitive").click(function() {
    CommandSearch();
});

let nodeClipboard = [];

function GetSelected()
{
    return document.getElementsByClassName("editor_selected");
}

const specialkeys = ["Control", "Shift", " "];
const KEY_CTRL = 0;
const KEY_SHIFT = 1;
const KEY_SPACE = 2;
let keysHeld = new Array(specialkeys.length);
keysHeld.fill(false);

function RemoveNode(element)
{
    for (let i of element.getElementsByClassName("nubIcon"))
    {
        if (i.getAttribute("zw-link"))
            UnlinkNubs(i);
    }
    element.remove();
    UpdateStaticLines();
}

$(document).keydown(function (e) {

    for (let k = 0; k < specialkeys.length; k++)
    {
        if (e.key == specialkeys[k])
            keysHeld[k] = true;
    }

    if (e.key == "Delete")
    {
        for (let i of GetSelected())
            RemoveNode(i);
    }

    if (!$("input").is(":focus") && keysHeld[KEY_CTRL])
    {
        switch (e.key)
        {
            case "z":
                UR_Undo();
                break;
            case "y":
                UR_Redo();
                break;
            case "c":
                if (GetSelected().length)
                {
                    nodeClipboard = [];
                    for (let i of GetSelected())
                        nodeClipboard.push(GetNodeElementFromName(i.id));
                }
                break;

            case "v":
                if (nodeClipboard.length)
                {
                    DeselectAll();
                    for (let n of nodeClipboard)
                    {
                        if (n.element.offsetLeft === n.element.offsetTop && n.element.offsetLeft === 0)
                            ProcSpawnNode(n.node, width / 2, height / 2);
                        else
                            ProcSpawnNode(n.node, n.element.offsetLeft + 50, n.element.offsetTop - 50);
                    }
                }
                break;

            case "x":
                if (GetSelected().length)
                {
                    nodeClipboard = [];
                    for (let i of GetSelected())
                    {
                        nodeClipboard.push(GetNodeElementFromName(i.id));
                        RemoveNode(i);
                    }
                }
                break;

            default:
                break;

        }
    }

});

$(document).keyup(function (e) {
    for (let k = 0; k < specialkeys.length; k++)
    {
        if (e.key == specialkeys[k])
            keysHeld[k] = false;
    }
});

graph.oncontextmenu = function () {return false};

function rightClick(e) { 
    e.preventDefault();
}



function ShowContext(x, y, bAdjust=true)
{
    commandSpawnPoint = { x: x, y: y};
    if (bAdjust)
    {
        if ((height - y) < 400) y -= 500;

        if ((width - x) < 400) x -= 500;
    }

    contextMenu.style.left = x + "px";
    contextMenu.style.top = y + "px";
    contextMenu.style.display = 'block';
}

const hintPopup = document.getElementById("hintPopup");
let hinttimeout;
let bhintwait;
let hintshowing = false;

function ShowHint(x, y, title, text)
{
    bhintwait = false;
    hintshowing = true;
    hintPopup.innerHTML = "<h4>" + title + "</h4><p>" + text + "</p>";
    hintPopup.style.display = 'block';
    hintPopup.style.top = (parseInt(hintPopup.style.top.substring(0, hintPopup.style.top.length - 2)) - hintPopup.clientHeight) + "px";
}

const hintspacing = 10;

$(".editor_hint").on('mouseenter', function(e) {
    hinttimeout = setTimeout(ShowHint, 1000, e.clientX, e.clientY, this.getAttribute("hint-title"), this.getAttribute("hint-desc"));
    bhintwait = true;
});

$(".editor_hint").on('mouseleave', function() {
    if (bhintwait)
    {
        clearTimeout(hinttimeout);
        bhintwait = false;
    }
    HideHint();
    hintshowing = false;
});

function HideHint()
{
    hintPopup.style.display = "none";
}

function HideContext() {
    contextMenu.style.display = "none";
    lctx.clearRect(0, 0, width, height);
}
