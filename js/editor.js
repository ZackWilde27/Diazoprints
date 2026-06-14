const actx = document.getElementById("allLines").getContext("2d");
const contextMenu = document.getElementById("contextMenu");
const doubleClickDuration = 250;
const baseDocumentName = "diazo_main_document";

// Disable built-in context menu
contextMenu.oncontextmenu = function () {return false};

const EDITOR_VERSION = "v1.1";

console.log("Editor " + EDITOR_VERSION);
document.getElementById("editor_version").innerHTML = EDITOR_VERSION;

let currentDocument = baseDocumentName;

function SaveDocument()
{
    StoreValues();
    localStorage.setItem(currentDocument, graph.innerHTML);
    SaveVariables();
    SaveFunctions();
}

async function SaveProject()
{
    let items = ["editor_currentModule", baseDocumentName, "editor_variables", "editor_functions", "NodeLength"];
    let project = "";
    for (let item of items)
        project += "<" + item + ">" + GetItem(item) + "</" + item + ">";

    download(project, "untitled-project.diazoprints", "");
}

function GetTagFromText(text, item)
{
    let tag = "<" + item + ">";
    return text.substring(text.indexOf(tag) + tag.length, text.indexOf("</" + item + ">"));
}

function OpenProjectForReal(txt)
{
    let items = ["editor_currentModule", baseDocumentName, "editor_variables", "editor_functions", "NodeLength"];
    for (let item of items)
        SetItem(item, GetTagFromText(txt, item));

    ReloadModule();
    LoadDocument(baseDocumentName);
}

function OpenProject(txt)
{
    let modulename = GetTagFromText(txt, "editor_currentModule")
    if (!ModuleInStorage(modulename))
    {
        MakeCustomDialog("Open Project", "You don\'t have the required module to load this project:\n" + modulename.substring(0, modulename.indexOf("_")), ["Continue", "Abort"], function(result) {
            if (result === "Continue")
                OpenProjectForReal(txt);
        });
        return;
    }
    OpenProjectForReal(txt);
}

async function LoadAndOpenProject(file)
{
    let text = await file.text();
    OpenProject(text);
}

$("#editor_openbtn").click(function() {
    AskForFile(function() {
        if ('files' in this)
            LoadAndOpenProject(this.files[0])
    });
});

$("#editor_savepbtn").click(SaveProject);



let functionNodes = [];

const functionStartNode = new editorNode("Function Name", 9, "", "o.;e.;", "");

const functionList = document.getElementById("editorfuncs");

function UpdateFunctionButtons()
{
    let funcbtn = functionList.parentElement.parentElement.previousElementSibling;
    GetSetting("function-format") ?funcbtn.classList.remove("d-none") : funcbtn.classList.add("d-none");

    let btns = "<div class=\"container-fluid\">";
    for (let i of functionNodes)
    {
        btns += "<div class=\"row bg-dark my-1\">";
        btns += "<div class=\"col-6 p-0\"><button type=\"button\" class=\"btn btn-bloop btn-block cmdBtn\"><sometext>" + i.name + "</sometext></button></div>";
        btns += "<div class=\"col-2 p-0\"><button type=\"button\" class=\"btn btn-bloop btn-block editor_funcbtn\"><i class=\"fa fa-pencil-square-o\"></i></button></div>";
        btns += "<div class=\"col-2 p-0\"><button type=\"button\" class=\"btn btn-bloop btn-block cmdBtn\" cmdval=\"Get " + i.name + "\"><sometext>Get</sometext></button></div>";
        btns += "<div class=\"col-2 p-0\"><button type=\"button\" class=\"btn btn-bloop btn-zdanger editor_funcdeletebtn\"><i class=\"fa fa-trash\"></i></button></div>";
        btns += "</div>";
    }
    btns += "</div>";

    functionList.innerHTML = btns;

    $(".editor_funcbtn").off().on('click', function() {
        functionName = this.parentElement.previousSibling.childNodes[0].childNodes[0].innerHTML;
        LoadFunction(functionName);
    });

    $(".editor_funcdeletebtn").off().on('click', function() {
        functionName = this.parentElement.previousSibling.previousSibling.previousSibling.childNodes[0].childNodes[0].innerHTML;
        AskToDelete("Delete Function", functionName, function() {
            RemoveFunction(functionName);
        });
    });
}

function FunctionExists(functionname)
{
    for (let i of functionNodes)
    {
        if (i.name == functionname)
            return true;
    }
    return false;
}

function MakeFunctionIO(io, bBlank=false)
{
    let newio = "";
    let splt = io.split(";");
    let v;

    for (let i = 0; i < splt.length - 1; i++)
    {
        v = bBlank ? "" : splt[i].split(".")[1];
        newio += "v." + v + "." + splt[i] + ";"; 
    }

    return newio;
}

function NewFunction(inputs)
{
    let functionname = "";

    functionname = inputs[0].value;
    let io = "e.;o.;e.;";

    if (FunctionExists(functionname))
    {
        MakeCustomDialog("Function Error", "Function already exists: " + functionname, ["Ok"], function() {});
        return;
    }

    SetItem(functionname, "");

    functionStartNode.io = "o.;" + MakeFunctionIO(io.substring(0, io.indexOf("o.;")));

    functionNodes.push(new editorNode(functionname, "6", "", io, ""));
    Commands[unsortedIndex].nodes.push(new editorNode("Get " + functionname, "1", functionname, "o.;fn.;", ""));
    graph.innerHTML = "";
    currentDocument = functionname;
    functionStartNode.name = functionname;

    if (functionStartNode.io)
        ProcSpawnNode(functionStartNode, 50, 50, "", "nub-editable");

    ProcSpawnNode(Commands[unsortedIndex].nodes.find(function(x) { return x.name == "Return"; }), 450, 50, "", "nub-editable");

    refreshGraph();
    FixAllConnections();
    UpdateStaticLines();
    UpdateFunctionButtons();
    RefreshCmdBtns();
    SaveDocument();
    SaveFunctions();
}

function GetNodes()
{
    return graph.getElementsByClassName("zw-Node");
}

function RefreshNubs(node_element, editor_node, name, isCompact=false, nubSubClass="")
{
    node_element.childNodes[1].remove();
    node_element.innerHTML += ProcSpawnNubs(editor_node, name, node_element.id, isCompact, nubSubClass);
}

function RefreshNubsFull(element, apinode, name)
{
    let connections = StoreNodeConnections(new NODEAPI_Node(element.id));
    RefreshNubs(element, apinode, name, [2, 4].includes(apinode.type), "");
    RestoreNodeConnections(connections, element);
}

function RefreshFunctionNodes()
{
    let functionname = currentDocument;

    let index = GetFunctionNodeIndex(functionname);

    let io = functionNodes[index].io.split("o.;");

    functionNodes[index].io = "o.;" + io[0];

    let startNode = GetNodes();

    let endNode = startNode[1];
    startNode = startNode[0];
    RefreshNubsFull(startNode, functionNodes[index], functionname);

    functionNodes[index].io = io.join("o.;");
    FixAllConnections();
}

function LoadFunction(functionname)
{
    graph.innerHTML = "";
    LoadDocument(functionname);

    RefreshFunctionNodes();

    refreshGraph();
    UpdateStaticLines();
}

function RemoveFunction(functionname)
{
    localStorage.setItem(functionname, "");
    for (let i = 0; i < functionNodes.length; i++)
    {
        if (functionNodes[i].name == functionname)
        {
            functionNodes.splice(i, 1);
            break;
        }
    }
    SaveFunctions();
    UpdateFunctionButtons();
}

function RenameFunction(functionname, newname)
{
    SetItem(newname, GetItem(functionname));
    SetItem(functionname, "");
    for (let i = 0; i < functionNodes.length; i++)
    {
        if (functionNodes[i].name == functionname)
        {
            functionNodes[i].name = newname;
            break;
        }
    }
    SaveFunctions();
}

function UpdateFunctionType(name, newtype)
{
    for (let i of functionNodes)
    {
        if (i.name == name)
        {
            i.type = newtype;
            return;
        }
    }
}

function UpdateFunctionOutput(name, newoutput)
{
    for (let i of functionNodes)
    {
        if (i.name === name)
        {
            i.output = newoutput;
            return;
        }
    }
}

function RemoveFunctionNub(name, side, nubindex)
{
    for (let i of functionNodes)
    {
        if (i.name === name)
        {
            let nubs = i.io.split("o.;");
            let nubside = nubs[side].split(";");
            nubside.splice(nubindex, 1);

            for (let i of nubside)
            {
                if (!i)
                    nubside.splice(nubside.indexOf(i), 1);
            }

            if (nubside.length) nubside.push("");

            nubs[side] = nubside.join(";");
            i.io = nubs.join("o.;");
            return;
        }
    }
}

function UpdateFunctionIO(name, side, nubindex, newnubdef)
{
    for (let i of functionNodes)
    {
        if (i.name === name)
        {
            let nubs = i.io.split("o.;");
            let nubside = nubs[side].split(";");

            for (let i of nubside)
            {
                if (!i)
                    nubside.splice(nubside.indexOf(i), 1);
            }

            nubside[nubindex] = newnubdef;
            nubs[side] = nubside.join(";") + ";";
            i.io = nubs.join("o.;");
            return;
        }
    }
}

function GetFunctionNodeIndex(name)
{
    for (let i = 0; i < functionNodes.length; i++)
    {
        if (functionNodes[i].name === name)
            return i;
    }

    return 0;
}

function SaveFunctions()
{
    let currentNode;
    
    if (currentDocument !== baseDocumentName)
    {
        for (let i of functionNodes)
        {
            if (i.name == currentDocument)
                currentNode = i;
        }

        if (!currentNode) return;

        voidfunctionflag = "";
        let converted = GetFunctionExec(currentDocument, 0);
        currentNode.type = voidfunctionflag ? "8" : "6";
        currentNode.io = currentNode.io.split("o.;")[0] + "o.;" + (voidfunctionflag ? "e.;" + voidfunctionflag + ".;" : "e.;");

        let len = currentNode.io.split("o.;")[0].split(";").length;
        let subtractor = currentNode.type == "8" ? 0 : 1;
        for (let i = 0; i < len; i++)
            converted = converted.replaceAll("%\\" + i, "%" + (i - subtractor));

        //converted = converted.replaceAll("\n", "\\n");
        currentNode.output = converted;

        //UpdateFunctionOutput(currentDocument, converted);
    }

    let txt = "";

    for (let i of functionNodes)
        txt += [i.name, i.type, i.output.replaceAll("\n", "\\n"), i.io, i.link].join(",") + "\n" + GetItem(i.name) + "\n\n";

    txt = txt.substring(0, txt.length - 1);
    SetItem("editor_functions", txt);
    console.log("Saved Document");

}

function LoadFunctions()
{
    if (GetItem("editor_functions"))
    {
        for (let i of GetItem("editor_functions").split("\n\n"))
        {
            if (i)
            {
                let splt = i.split("\n");

                // If there's a bug, it'll automatically try to fix it
                if (splt[0] === "")
                {
                    splt[0] = splt[1];
                    splt[1] = splt[2];
                }

                splt[0] = splt[0].SmartSplit(",");
                functionNodes.push(new editorNode(splt[0]));
                Commands[unsortedIndex].nodes.push(new editorNode("Get " + splt[0][0], "1", splt[0][0], "o.;fn.;", ""));
                SetItem(splt[0][0], splt[1]);
            }
        }
    }
}

function LoadDocument(documentname=baseDocumentName)
{
    selectedElement = null;
    selectedType = null;
    DeselectAll();
    currentDocument = documentname;
    graph.innerHTML = GetItem(currentDocument);

    RestoreStoredValues();

    for (let i of (InFunction() ? Array.from(GetNodes()).slice(2) : GetNodes()))
    {
        let funcNode = IsFunctionNode(GetNodeTitle(i));
        if (funcNode)
            RespawnNode(i, new NODEAPI_Node(i.id), funcNode);
    }

    refreshGraph();
    UpdateClickables();
    UpdateStaticLines();
    UpdateMovers();
}

function ClearFunctions()
{
    functionNodes = [];
    SaveFunctions();
}

function ClearVariables()
{
    editorVars = [];
    SaveVariables();
}

function NewDocumentForReal()
{
    currentDocument = baseDocumentName;
    SetItem(baseDocumentName, "");

    ClearVariables();
    RefreshVars();

    ClearFunctions();
    UpdateFunctionButtons();

    reservedvars = 0;
    SetItem("NodeLength", "0");
    SetItem("diazo_type_overrides", "");

    ReloadModule();

    graph.innerHTML = "";
    let x = 0;
    for (let t of Commands[0].nodes)
    {
        ProcSpawnNode(t, x, 0);
        x += 300;
    }

    UpdateStaticLines();

    SaveDocument();
}

function NewDocument(ask=true)
{
    if (!ask)
    {
        NewDocumentForReal();
        return;
    }

    MakeCustomDialog("New Document", "Are you sure you want to clear everything?", ["Yes", "No"], function(result) {
        if (result === "Yes")
            NewDocumentForReal();
    });
}

function LoadExampleDocument()
{
    graph.innerHTML = `<div class="container zw-Node diazo-draggable " id="begin13182" style="box-shadow: 50px 50px 100px #80808032, inset var(--grStrN) 0px 15px #ffffffff, inset var(--grStr) 0px 15px #000000ff, inset 0px var(--grStrN) 5px #7fffffff; top: 390px; left: 323px;"><div class="row editorNodeTop" id="begin13182top"><div class="col-12"><nodetitle>Begin</nodetitle></div></div><div class="row px-0 py-4"><div class="col-7 mx-auto p-0 text-left my-auto"><div class="container-fluid"></div></div><div class="col-5 text-right mx-auto p-0 my-auto"><div class="container-fluid pl-0"><div class="row"><div class="col-8 p-0 my-auto"><nubtext></nubtext></div><div class="col-3 text-center p-0 my-auto"><button class="nub editor_hint " hint-desc="exec" hint-title="" style="color: #FFFFFF"><i id="begin13182-out0" z-val="" zw-type="e" class="nubIcon fa fa-caret-square-o-right fa-2x zw-arrow" zw-link="logconsole54160-in0"></i></button></div><div class="col-1 p-0 pl-2"><br></div><!--</div--></div></div></div></div></div><div class="container zw-Node diazo-draggable" id="logconsole54160" style="box-shadow: 50px 50px 100px #80808032, -50px 50px 100px #554c7732, inset var(--grStrN) 0px 15px #ffffffff, inset var(--grStr) 0px 15px #aa98edff, inset 0px var(--grStrN) 5px #d54c76ff; top: 390px; left: 980px;"><div class="row editorNodeTop" id="logconsole54160top"><div class="col-12"><nodetitle>log (console)</nodetitle></div></div><div class="row px-0 py-4"><div class="col-7 mx-auto p-0 text-left my-auto"><div class="container-fluid"><div class="row"><div class="col-1 p-0 pr-2"><br></div><div class="col-3 text-center p-0 my-auto"><button class="nub editor_hint " hint-desc="exec" hint-title="" style="color: #FFFFFF"><i id="logconsole54160-in0" z-val="" zw-type="e" class="nubIcon fa fa-caret-square-o-right fa-2x zw-arrow" zw-link="begin13182-out0"></i></button></div><div class="col-8 p-0 my-auto"><nubtext></nubtext></div></div><div class="row"><div class="col-1 p-0 pr-2"><br></div><div class="col-3 text-center p-0 my-auto"><button class="nub editor_hint " hint-desc="console&lt;br&gt;Default: console" hint-title="" style="color: #0093F5"><i id="logconsole54160-in1" z-val="" zw-type="console" class="nubIcon fa fa-2x fa-question"></i></button></div><div class="col-8 p-0 my-auto"><nubtext>console</nubtext></div></div><div class="row"><div class="col-1 p-0 pr-2"><br></div><div class="col-3 text-center p-0 my-auto"><button class="nub editor_hint " hint-desc="auto" hint-title="" style="color: rgb(255, 56, 212);"><i id="logconsole54160-in2" z-val="" zw-type="s" class="nubIcon fa fa-circle fa-2x zw-arrow" zw-link="string11581-out0"></i></button></div><div class="col-8 p-0 my-auto"><nubtext></nubtext></div></div></div></div><div class="col-5 text-right mx-auto p-0 my-auto"><div class="container-fluid pl-0"><div class="row"><div class="col-8 p-0 my-auto"><nubtext></nubtext></div><div class="col-3 text-center p-0 my-auto"><button class="nub editor_hint " hint-desc="exec" hint-title="" style="color: #FFFFFF"><i id="logconsole54160-out0" z-val="" zw-type="e" class="nubIcon fa fa-caret-right fa-2x" zw-link=""></i></button></div><div class="col-1 p-0 pl-2"><br></div><!--</div--></div></div></div></div></div><div class="container zw-Node diazo-draggable" id="string11581" style="box-shadow: 50px 50px 100px #801c6a32, -50px 50px 100px #801c6a32, inset var(--grStrN) 0px 15px #ff38d4ff, inset var(--grStr) 0px 15px #ff38d4ff, inset 0px var(--grStrN) 5px #ff38d4ff; top: 613px; left: 579px;"><div class="row editorNodeTop" id="string11581top"><div class="col-12"><nodetitle>String</nodetitle></div></div><div class="row px-0 py-4"><div class="col-7 mx-auto p-0 text-left my-auto"><div class="container-fluid"><div class="row p-0"><div class="col-1 p-0 pr-2"></div><div class="col-7 p-0"><input id="string11581-in0" class="editor_input w-100" type="text" z-stored-value="Hello World!"></div><div class="col-4 px-2"> </div></div></div></div><div class="col-5 text-right mx-auto p-0 my-auto"><div class="container-fluid pl-0"><div class="row"><div class="col-8 p-0 my-auto"><nubtext></nubtext></div><div class="col-3 text-center p-0 my-auto"><button class="nub editor_hint " hint-desc="String" hint-title="" style="color: #FF38D4"><i id="string11581-out0" z-val="" zw-type="s" class="nubIcon fa fa-circle fa-2x zw-arrow" zw-link="logconsole54160-in2"></i></button></div><div class="col-1 p-0 pl-2"><br></div><!--</div--></div></div></div></div></div><div id="3010" class="container diazo-comment diazo-draggable" style="top: 261px; left: 324px;"><div id="3010top" class="row diazo-comment-header grabbable"><div class="col-12 py-2"></div></div><div class="row p-0 diazo-comment-content"><textarea class="editor_input diazo-comment-input w-100 text-white" value="TODO: " z-stored-value="JavaScript Example\n\nPrints &quot;Hello World!&quot;" style="height: 90px;"></textarea><div class="col-12"></div></div></div><div id="8887" class="container diazo-comment diazo-draggable" style="top: 171px; left: 1045px;"><div id="8887top" class="row diazo-comment-header grabbable"><div class="col-12 py-2"></div></div><div class="row p-0 diazo-comment-content"><textarea class="editor_input diazo-comment-input w-100 text-white" value="TODO: " z-stored-value="Use the Preview Selected or Preview All buttons\nin the VIEWER tab to see what the code output looks like before exporting" style="height: 88px;"></textarea><div class="col-12"></div></div></div><div id="18050" class="container diazo-comment diazo-draggable" style="top: 175px; left: 724px;"><div id="18050top" class="row diazo-comment-header grabbable"><div class="col-12 py-2"></div></div><div class="row p-0 diazo-comment-content"><textarea class="editor_input diazo-comment-input w-100 text-white" value="TODO: " z-stored-value="Use the Export Selected or Export All buttons in the FILE tab to save the code as a .js file, where it can then be used in a project" style="height: 82px;"></textarea><div class="col-12"></div></div></div>`;
    RestoreStoredValues();
    refreshGraph();
    UpdateStaticLines();
    SaveDocument();
}

HTMLElement.prototype.zw_AddLink = function(id) {
    let links = this.getAttribute("zw-link");
    if (links)
    {
        links = links.split(",");
        if (!links.includes(id))
            this.setAttribute("zw-link", links.concat([id]).join(","));
    }
    else
        this.setAttribute("zw-link", id);

    ResetNub(this);
};

HTMLElement.prototype.zw_HasLink = function(id) {
    let links = this.getAttribute("zw-link");
    if (!links) return false;
    return links.split(",").includes(id);
};

HTMLElement.prototype.zw_RemoveLink = function(id) {
    let link = this.getAttribute("zw-link");

    if (link)
    {
        link = link.split(",");
        link.splice(link.indexOf(id), 1);
        this.setAttribute("zw-link", link.join(","));
    }

    ResetNub(this);
};

let viewsweepinterval;
let target = [0, 0];
let centre = [Math.round(window.innerWidth / 2), Math.round(window.innerHeight / 2)];
const sweepSpeed = 0.15;
const sweepDelay = 16.6;
const draggableClass = "diazo-draggable";

function ViewSweep()
{
    if (Math.abs(target[0] - centre[0]) < 2 && Math.abs(target[1] - centre[1]) < 2)
    {
        $(".showerror").removeClass("showerror");
        clearInterval(viewsweepinterval);
    }

    let dx = (centre[0] - target[0]) * sweepSpeed;
    let dy = (centre[1] - target[1]) * sweepSpeed;

    for (let node of Array.from(document.getElementsByClassName(draggableClass)))
    {
        node.style.left = Math.round(node.offsetLeft + dx) + "px";
        node.style.top = Math.round(node.offsetTop + dy) + "px";
    }

    target[0] += dx;
    target[1] += dy;

    UpdateStaticLines();
}

function FocusOnNode(id)
{
    centre = [Math.round(window.innerWidth / 2), Math.round(window.innerHeight / 2)];

    let e = document.getElementById(id);
    target[0] = e.offsetLeft;
    target[1] = e.offsetTop;
    clearInterval(viewsweepinterval);
    viewsweepinterval = setInterval(ViewSweep, 16.66666666666667);
}

$("#editor_loadbtn").click(LoadDocument);
$("#editor_savebtn").click(SaveDocument);
$("#editor_newbtn").click(NewDocument);

function EById(id)
{
    return document.getElementById(id);
}

function IOReplace(io, isOut, index, newval)
{
    let list = io.split("o.;");
    let putIndex = isOut ? 1 : 0;
    list[putIndex] = list[putIndex].split(";").splice(index, 1, newval).join(";");
    return list.join("o.;");
}

function UpdateGradients(nodeid)
{
    if (!nodeid) return;

    // Updating the lighting fx
    let node = new NODEAPI_Node(nodeid);
    let oldio = "";
    if (node.node)
    {
        if (node.node.io.split("o.;")[0])
        {
            for (let i of node.GetInputs())
                oldio += i.element.getAttribute("zw-type") + ".;";
        }

        oldio += "o.;";
        if (node.node.io.split("o.;")[1])
        {
            for (let i of node.GetOutputs())
                oldio += i.element.getAttribute("zw-type") + ".;";
        }

        node.element.style.boxShadow = BoxShadowFromGradients(GradientsFromCode(oldio), oldio).replace(";", "");
    }
}

function ChangeNubType(nubElement, newtypeletter)
{
    // Updating the nub
    let newtype = GetTypeFromLetter(newtypeletter);
    nubElement.setAttribute("zw-type", newtypeletter);
    nubElement.parentElement.style.color = newtype.colour;
    nubElement.classList = "fa fa-" + (nubElement.getAttribute("zw-link") ? newtype.icons[1] + " zw-arrow" : newtype.icons[0]) + " fa-2x ";

    UpdateGradients(nubElement.id.substring(0, nubElement.id.indexOf("-")));
}

function ChangeAutoIO(target, tt, st)
{
    if (tt === "g" && st !== "g")
        ChangeNubType(target, st);
}

function RespawnNodeFromElement(element)
{
    let node = new NODEAPI_Node(element.id);
    RespawnNode(element, node, node.node);
}

function GetNodeTitle(element)
{
    let t = element.getElementsByTagName("nodetitle")[0];

    if (t.getAttribute("node-pointer"))
        return t.getAttribute("node-pointer");

    return t.innerHTML;
}

function StoreNodeConnections(api_node)
{
    // Storing previous connections
    let inputConnections = [];
    let outputConnections = [];

    for (let i of api_node.GetInputs())
        inputConnections.push(i.attachedNub ? i.attachedNub : false);

    for (let i of api_node.GetOutputs())
        outputConnections.push(i.attachedNub ? i.attachedNub : false);

    return [inputConnections, outputConnections];
}

function SafeGetAttribute(object, attribute)
{
    let attr = object.getAttribute(attribute);
    if (!attr)
        return "";

    return attr;
}

function RestoreNodeConnections(connections, element)
{
    let inputConnections, outputConnections;
    [inputConnections, outputConnections] = connections;

    // Re-doing those previous connections
    newNode = new NODEAPI_Node(element.id);
    let newinputs = newNode.GetInputs();

    let end = Math.min(inputConnections.length, newinputs.length);

    for (let i = 0; i < end; i++)
    {
        if (inputConnections[i])
        {
            isOut = true;
            selected = inputConnections[i];
            selectedType = inputConnections[i].getAttribute("zw-type");
            LinkNubs(newinputs[i].element);
        }
    }
    
    let newoutputs = newNode.GetOutputs();
    end = Math.min(outputConnections.length, newoutputs.length);
    for (let i = 0; i < end; i++)
    {
        if (outputConnections[i])
        {
            isOut = false;
            selected = newoutputs[i].element;
            selectedType = newoutputs[i].element.getAttribute("zw-type");
            LinkNubs(outputConnections[i]);
        }
    }
}

function RespawnNode(element, api_node, nodedef)
{
    let connections = StoreNodeConnections(api_node);

    // Respawning the node
    let x = element.offsetLeft;
    let y = element.offsetTop;
    RemoveNode(element);
    ProcSpawnNode(nodedef, x, y);

    RestoreNodeConnections(connections, GetLastSpawnedNode());
    FixAllConnections();
}

// Already knows the selected element
function LinkNubs(target)
{
    let undoer = "document.getElementById(\"" + target.id + "\").zw_RemoveLink(\"" + selected.id + "\"); document.getElementById(\"" + selected.id + "\").zw_RemoveLink(\"" + target.id + "\");";
    let redoer = "";

    // Unlink if you click on the nub, or to be more percise, if you click and drag from one nub back to the same nub
    if (selected.id === target.id)
    {
        UnlinkNubs(selected);
        ResetNub(selected);
        FixAllConnections();
        UpdateStaticLines();
        refreshGraph();
        return false;
    }

    if ((GetNubIsOut(selected.id) === GetNubIsOut(target.id)) || ((selectedType === 'e') != (target.getAttribute("zw-type") == 'e')))
    {
        ResetSelected();
        return false;
    }

    // Checks for and removes already existing connections when a nub can only have 1
    if (isOut === (selectedType === 'e'))
    {
        if (selected.getAttribute('zw-link'))
        {
            if (selected.getAttribute('zw-link') !== "")
            {
                for (let i of selected.getAttribute('zw-link').split(","))
                {
                    if (!i) debugger;
                    undoer += " selected = document.getElementById(\"" + selected.id + "\"); LinkNubs(document.getElementById(\"" + i + "\"));";
                    redoer += " UnlinkNubs(document.getElementById(\"" + selected.id + "\"));"
                }
                UnlinkNubs(selected);
            }
        }
    }
    else
    {
        if (target.getAttribute('zw-link'))
        {
            if (!["", "null"].includes(target.getAttribute('zw-link')))
                UnlinkNubs(target);
        }
    }

    let tt = target.getAttribute("zw-type");
    let st = selected.getAttribute("zw-type");

    ChangeAutoIO(target, tt, st);
    ChangeAutoIO(selected, st, tt);

    tt = GetTypeFromLetter(tt);
    st = GetTypeFromLetter(st);
    target.classList = "nubIcon fa fa-" + tt.icons[1] + " fa-2x zw-arrow";
    selected.classList = "nubIcon fa fa-" + st.icons[1] + " fa-2x zw-arrow";

    selected.zw_AddLink(target.id);
    target.zw_AddLink(selected.id);

    if (bCustomLines)
    {
        if (isOut === (selectedType !== 'e'))
            target.setAttribute("customline", customlinebuffer.join(",,"))
        else
            selected.setAttribute("customline", customlinebuffer.join(",,"))
    }

    drw = false;
    FixAllConnections();

    lctx.clearRect(0, 0, width, height);
    UpdateStaticLines();

    refreshGraph();
    UpdateClickables();

    undoer += " UpdateStaticLines();"
    redoer += "selected = document.getElementById(\"" + selected.id + "\"); LinkNubs(document.getElementById(\"" + target.id + "\"));";

    UR_AddAction(undoer, redoer);

    selectedType = null;

    return true;
}

function GetAddonsFromLang(lang)
{
    for (let i of editor_addons)
    {
        if (i.lang === lang)
            return i.addons;
    }

    return [];
}

function RemoveAddonFromLang(lang, addon)
{
    for (let i of editor_addons)
    {
        if (i.lang === lang)
        {
            for (let j = 0; j < i.addons.length; j++)
            {
                if (i.addons[j][0] == addon)
                {
                    i.addons.splice(j, 1);
                    return;
                }
            }
            return;
        }
    }
}

function RemoveFromLinks(target, name)
{
    let t = SafeGetAttribute(target, "zw-link").split(",");
    let i = 0;
    while (i < t.length)
    {
        if (t[i] == name)
            t.splice(i, 1);
        else
            i++;
    }

    target.setAttribute("zw-link", t.join(","));
    if (!target.getAttribute("zw-link") && target.parentElement.getAttribute("hint-desc") == "auto")
        ChangeNubType(target, "g");
}

function UnlinkNubs(target)
{
    let tt = GetTypeFromLetter(target.getAttribute("zw-type"));

    if (!target.getAttribute("zw-link")) return;

    for (let o of target.getAttribute("zw-link").split(","))
    {
        let other = document.getElementById(o);
        if (other && other.getAttribute("zw-link"))
        {
            let ot = GetTypeFromLetter(other.getAttribute("zw-type"));
            if (!other.getAttribute("zw-link").includes(","))
                other.classList = "nubIcon fa fa-" + ot.icons[0] + " fa-2x";
            RemoveFromLinks(other, target.id);
        }
        else
            target.setAttribute("zw-link", target.getAttribute("zw-link").split(",").slice(1).join(","));
    }

    target.classList = "nubIcon fa fa-" + tt.icons[0] + " fa-2x";
    target.setAttribute("zw-link", "");

    if (!target.getAttribute("zw-link") && target.parentElement.getAttribute("hint-desc") == "auto")
        ChangeNubType(target, "g");

    selectedType = null;
}

let bMobile = false;

let tempLineStyle = "#FFFFFF";

function ResetNub(element)
{
    let icons = GetIconFromLetter(element.getAttribute("zw-type"));

    if (!getById(element.id)) return;
    getById(element.id).classList = "nubIcon fa fa-" + icons[element.getAttribute("zw-link") ? 1 : 0] + " fa-2x zw-arrow";
}

function ResetSelected()
{
    if (!selected) return;
    ResetNub(selected);
}

let timeSinceLastDrag = 0;

function StartDrag(e, thisval=this) {
    e.preventDefault();

    drw = true;

    if ((Date.now() - timeSinceLastDrag) < doubleClickDuration)
    {
        selected = thisval.getElementsByTagName("i")[0];

        if (GetNubIsOut(selected.id)) return;

        selectedType = selected.getAttribute("zw-type");

        let typename = GetTypeFromLetter(selectedType).name;
        ProcSpawnNode(Commands[1].nodes.find(function(x) { return x.name === typename; }), e.clientX - 350, e.clientY);
        let newnode = new NODEAPI_Node(GetLastSpawnedNode().id);
        LinkNubs(newnode.GetOutputs()[0].element);
        StopHint();
    }
    timeSinceLastDrag = Date.now();

    bMobile = false;
    if ('TouchEvent' in window)
        bMobile = e.constructor === TouchEvent.constructor;

    selected = thisval.getElementsByTagName("i")[0];
    isOut = GetNubIsOut(selected.id);
    selectedType = selected.getAttribute("zw-type");
    
    selected.classList = "nubIcon fa fa-" + GetIconFromLetter(selectedType)[1] + " fa-2x";

    customlineX = e.clientX;
    customlineY = e.clientY;
    customlinebuffer = [];

    draggingelement = thisval;
    let rect = thisval.getBoundingClientRect();
    lastX = rect.x + (rect.width / 2);
    lastY = rect.y + (rect.height / 2);
    tempLineStyle = NodeColourFromLetter(selectedType);

}

function EndDrag(e, thisVal=this) {
    if (e.type == "touchend" && (touchtargetelem != graph))
    {
        //e.preventDefault();
        lctx.clearRect(0, 0, width, height);
        if (drw)
        {
            if (touchtargetelem && touchtargetelem.classList.contains("nubIcon"))
                LinkNubs(touchtargetelem);
            else
                UnlinkNubs(selected);

            touchtargetelem = null;
            UpdateStaticLines();
            SaveDocument();
            drw = false;
        }

        return;
    }

    switch (e.which)
    {
        case 1:
            e.preventDefault();
            lctx.clearRect(0, 0, width, height);
            if (drw)
            {
                LinkNubs(thisVal.getElementsByClassName("fa")[0]);
                SaveDocument();
                drw = false;
            }
            break;
        case 3:
            e.preventDefault();
            MakeGenericContextMenu(
                [
                    [
                        "To Input",
                        function () {
                            thisVal.parentElement.innerHTML = "<input id=\"" + thisVal.childNodes[0].id + "\" class=\"editor_input w-100\" type=\"" + GetTypeFromLetter(thisVal.childNodes[0].getAttribute("zw-type")).input + "\">";
                        }
                    ]
                ],
                e.clientX,
                e.clientY
            );
    }

}

function RespawnAllVarNodes(varname)
{
    let toBeRespawned = [];
    for (let i of GetNodes())
    {
        if (GetNodeTitle(i).substring(4) == varname)
            toBeRespawned.push(i.id);
    }

    for (let i of toBeRespawned)
        RespawnNodeFromElement(getById(i));
}

class VelocityElement
{
    constructor(id, x, y)
    {
        this.id = id;
        this.x = x;
        this.y = y;
    }
}

let velocityloop;

function StartVelocityLoop()
{
    velocityloop = setInterval(function() {

        if (!kineticelements.length)
        {
            clearInterval(velocityloop);
            return;
        }

        let e;
        let length = kineticelements.length;
        for (let i = 0; i < length; i++)
        {
            if (!kineticelements[i])
            {
                // Javascript technically has goto but not actually.
                kineticelements.splice(i, 1);
                continue;
            }

            e = getById(kineticelements[i].id);
            if (!e)
            {
                kineticelements.splice(i, 1);
                continue;
            }

            e.style.left = (parseInt(e.style.left) + Math.floor(kineticelements[i].x)) + "px";
            e.style.top = (parseInt(e.style.top) + Math.floor(kineticelements[i].y)) + "px";
            kineticelements[i].x *= 0.75;
            kineticelements[i].y *= 0.75;

            if ((Math.abs(kineticelements[i].x) + Math.abs(kineticelements[i].y)) < 0.5)
            {
                kineticelements.splice(i, 1);
                i--;
            }
        }
        UpdateStaticLines();

    }, 16);
}

// Array of VelocityElements
let kineticelements = [];



function AddVelocityElement(id, x, y)
{
    kineticelements.push(new VelocityElement(id, x, y));
    if (kineticelements.length == 1)
        StartVelocityLoop();
}

function dragElement(elmnt) {
    var pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

    let startX, startY;

    if (document.getElementById(elmnt.id + "top")) {
      // if present, the header is where you move the DIV from:
      document.getElementById(elmnt.id + "top").onmousedown = dragMouseDown;
      OnOnce($("#" + elmnt.id + "top"), "touchstart", dragTouchStart);
    } else {
      // otherwise, move the DIV from anywhere inside the DIV:
      elmnt.onmousedown = dragMouseDown;
      OnOnce($("#" + elmnt.id), "touchstart", dragTouchStart);
    }
    
    function dragMouseDown(e) {
      e.preventDefault();

      if (e.which !== 1) return;

      if ((Date.now() - timeSinceLastDrag) < doubleClickDuration)
      {
          // Double click
          let nodename = GetNodeTitle(e.currentTarget);
          if (IsFunctionNode(nodename))
          {
              LoadFunction(nodename);
          }
      }
  
      timeSinceLastDrag = Date.now();

      if (!keysHeld[KEY_SHIFT])
          DeselectAll();
      selectedElement = e.currentTarget;
      let parent = e.currentTarget.parentElement;

      while (!parent.classList.contains(draggableClass))
          parent = parent.parentElement;

      parent.classList.add("editor_selected");
      // get the mouse cursor position at startup:
      pos3 = e.clientX;
      pos4 = e.clientY;
      startX = elmnt.offsetLeft;
      startY = elmnt.offsetTop;
      document.onmouseup = closeDragElement;
      // call a function whenever the cursor moves:
      document.onmousemove = elementDrag;
    }

    function dragTouchStart(e) {
        e.preventDefault();

        const touches = e.changedTouches;

        if (!keysHeld[KEY_SHIFT])
            DeselectAll();

        selectedElement = e.currentTarget;
        let parent = e.currentTarget.parentElement;

        while (!parent.classList.contains(draggableClass))
            parent = parent.parentElement;

        parent.classList.add("editor_selected");
        // get the mouse cursor position at startup:
        pos3 = touches[0].clientX;
        pos4 = touches[0].clientY;
        document.addEventListener("touchend", closeDragElement);
        // call a function whenever the cursor moves:
        document.addEventListener("touchmove", elementDragTouch);
    }
  
    function elementDrag(e) {
      e.preventDefault();
      // calculate the new cursor position:
      pos1 = pos3 - e.clientX;
      pos2 = pos4 - e.clientY;
      // set the element's new position:
      elmnt.style.top = (elmnt.offsetTop - pos2) + "px";
      elmnt.style.left = (elmnt.offsetLeft - pos1) + "px";
      pos3 = e.clientX;
      pos4 = e.clientY;
      UpdateStaticLines();
    }

    function elementDragTouch(e) {
        e.preventDefault();
        const touches = e.changedTouches;
        // calculate the new cursor position:
        pos1 = pos3 - touches[0].clientX;
        pos2 = pos4 - touches[0].clientY;
        // set the element's new position:
        elmnt.style.top = (elmnt.offsetTop - pos2) + "px";
        elmnt.style.left = (elmnt.offsetLeft - pos1) + "px";
        pos3 = touches[0].clientX;
        pos4 = touches[0].clientY;
        UpdateStaticLines();
    }
  
    function closeDragElement() {
      // stop moving when mouse button is released:
      const getbyidtext = "document.getElementById(\""

      UR_AddAction(
        getbyidtext + elmnt.id + "\").style.left = \"" + startX + "px\"; " + getbyidtext + elmnt.id + "\").style.top = \"" + startY + "px\"; UpdateStaticLines();",
        getbyidtext + elmnt.id + "\").style.left = \"" + elmnt.offsetLeft + "px\"; " + getbyidtext + elmnt.id + "\").style.top = \"" + elmnt.offsetTop + "px\"; UpdateStaticLines();",
      );

      if ((Math.abs(pos1) + Math.abs(pos2)) > 1)
      {
        AddVelocityElement(elmnt.id, -pos1, -pos2);
      }

      document.onmouseup = null;
      document.removeEventListener("touchend", closeDragElement);
      document.onmousemove = null;
      document.removeEventListener("touchmove", elementDragTouch);
      SaveDocument();
    }
  }

// Makes it less tedious to make sure a listener is only added once.
function OnOnce(jq, event, func)
{
    jq.off(event).on(event, func);
}

function IsFunctionNode(nodename)
{
    for (let i of functionNodes)
    {
        if (i.name == nodename)
        {
            return i;
        }
    }
    return false;
}

function UpdateFunctionNodes()
{
    for (let i of graph.getElementsByClassName("zw-Node"))
    {
        if (IsFunctionNode(GetNodeTitle(i)))
        {
            RespawnNodeFromElement(i);
        }
    }
}

function GetLastSpawnedNode()
{
    let nodes = graph.getElementsByClassName("zw-Node");
    return nodes[nodes.length - 1];
}

function MakeGenericContextBtn(name)
{
    return "<div class=\"col-12 p-0\"><button type=\"button\" class=\"btn w-100 btn-shaded generic-context-btn px-2 py-1\">" + name + "</button></div>";
}

let contextSelectedNode;

function InFunction()
{
    return currentDocument !== baseDocumentName;
}

function GetAllChildNodes(element)
{
    let output = [element];
    for (let i of element.childNodes)
    {
        output += GetAllChildNodes(i);
    }
    return output;
}

// options contains lists where the first item is the name and the second item is the onclick function
function MakeGenericContextMenu(options, x, y)
{
    let fullHTML = "<div class=\"row\">";

    for (let i of options)
    {
        fullHTML += MakeGenericContextBtn(i[0]);
    }

    fullHTML += "</div>";
    contextSelectedNode = this;
    $("#contextMenu").removeClass("w-500px");
    $("#contextMenu").html(fullHTML);

    OnOnce($(".generic-context-btn"), 'click', function() {
        for (let i of options)
        {
            if (i[0] == this.innerText)
            {
                i[1]();
                HideContext();
                break;
            }
        }
    });
    ShowContext(x, y, false);
}

function MakeParameterName(name)
{
    return GetSetting("param-format").replace("%name", name);
}

function refreshGraph(){
    var draggables = graph.getElementsByClassName(draggableClass);
    for(let l = 0; l < draggables.length; l += 1){
        dragElement(draggables[l]);
    }

    OnOnce($(".editor_input"), 'focus', function (e) {
        disableShortcuts = true;
    });

    OnOnce($(".editor_input"), 'defocus', function (e) {
        disableShortcuts = false;
    });

    OnOnce($(".nub"), 'mousedown', function(e) {
        switch (e.which)
        {
            case 1:
                StartDrag(e, this);
                break;
            case 3:
                e.preventDefault();
            default:
                break;
        }
    });
    OnOnce($(".nub"), "touchstart", StartDrag);

    $(".nub").mouseup(function(e) { EndDrag(e, this) } );
    OnOnce($(".nub"), "touchend", function(e) { EndDrag(e, this) });

    OnOnce($(".zw-Node"), 'mouseup', function(e) {
        if (drw && (e.which == 1))
        {
            if (![this, this.childNodes[1], ...(this.childNodes[1].childNodes)].includes(e.target)) return;
            let index = (e.clientX - this.offsetLeft) > 150 ? 1 : 0;
            let funcNode;
            if (InFunction())
            {
                let nodes = GetNodes();
                if ([nodes[0], nodes[1]].includes(this))
                {
                    funcNode = IsFunctionNode(currentDocument);
                    index = 1 - index;
                }
            }
            else
            {
                funcNode = IsFunctionNode(GetNodeTitle(this));
            }

            if (funcNode)
            {
                e.preventDefault();

                if (!funcNode.io)
                    funcNode.io = "o.;";

                let io = funcNode.io.split("o.;");

                io[index] += (index ? "" : "v.[" + MakeParameterName("new_param") + "].") + selectedType + ".new_param;";
                funcNode.io = io.join("o.;");
                let storedselected = selected;
                if (InFunction())
                {
                    RefreshFunctionNodes();
                    let puts = new NODEAPI_Node(GetNodes()[index].id);
                    puts = index ? puts.GetInputs() : puts.GetOutputs();
                    selected = storedselected;
                    selectedType = selected.getAttribute("zw-type");
                    LinkNubs(puts[puts.length - 1].element);

                }
                else
                {
                    RespawnNodeFromElement(this);

                    let respawnedNode = new NODEAPI_Node(GetLastSpawnedNode().id);

                    let puts = [];
                    if (index)
                        puts = respawnedNode.GetOutputs();
                    else
                        puts = respawnedNode.GetInputs();

                    selected = storedselected;
                    selectedType = selected.getAttribute("zw-type");
                    LinkNubs(puts[puts.length - 1].element);
                }
                SaveDocument();
            }
        }

        if (e.which === 3)
        {

            if (!GetAllChildNodes(this.childNodes[0]).includes(e.target)) return;

            DeselectAll();
            this.classList.add("editor_selected");

            let apinode = new NODEAPI_Node(this.id);

            let thisval = this;
            MakeGenericContextMenu(
                [
                    [
                        "Refresh",
                        function() {
                            RespawnNode(thisval, apinode, apinode.node);
                        }
                    ],
                    [
                        "Delete",
                        function() {
                            RemoveNode(thisval);
                        }
                    ]
                ],
                e.clientX,
                e.clientY
            );
        }
    });
}

// GRAPH CONTEXT MENU

var sweep = false;
var scrollX = 0;
var scrollY = 0;

const lctx = document.getElementById("blueLines").getContext("2d");
var lastX;
var lastY;

function UpdateDebug(){
    $("#debug").html("drw: " + drw + " selectedType: " + selectedType + "<br>whichNode: " + whichNode + " isOut: " + isOut + "<br>bMobile: " + bMobile);
}

//setInterval(UpdateDebug, 250);

var zoomLevel = 1.0
const zoomPercision = 0.25;
const h1FontSize = 40;

let start = 0.0;



$("#Graph").mousedown(function(e) {
    if (e.target === this)
    {
        switch (e.which)
        {
            case 1:
                if (!keysHeld[KEY_SPACE])
                {
                    if (selectedType && selected)
                    {
                        ResetSelected();
                        selected = null;
                        selectedType = null;
                    }
                    
                    HideContext();
                    DeselectAll();
                    break;
                }
            case 2:
            case 3:
                e.preventDefault();
                sweep = true;
                start = Date.now();
                break;
        }
    }
});

let lastTX = 0;
let lastTY = 0;
let bTDrag = false;
let draggingelement;

OnOnce($("#Graph"), 'touchstart', function(e) {
    if (e.target == this)
    {
        if (selectedType && selected)
        {
            ResetSelected();
            selected = null;
            selectedType = null;
        }
        HideContext();
        DeselectAll();
        e.preventDefault();
        sweep = true;
        lastTX = e.changedTouches[0].clientX;
        lastTY = e.changedTouches[0].clientY;
        start = Date.now();
    }
});

let ctxSensitive = false;

function MakeCommandsMenu()
{
    $("#contextMenu").html("<div class=\"row position-fixed z-5 px-2 py-2 rounded-lg w-500px\" id=\"contextTop\">\n\t<div class=\"col-7\">\n\t\t<input type=\"text\" class=\"text-center form-control\" id=\"contextSearch\">\n\t</div>\n\t<div class=\"col-5 m-auto\">\n\t\t<nodetitle>==</nodetitle><i id=\"contextSensitive\" class=\"px-2 fa " + (ctxSensitive ? "fa-toggle-on" : "fa-toggle-off") + " fa-2x\"></i><nodetitle>===</nodetitle>\n\t</div>\n</div>\n<div class=\"menu mt-5 w-100\" id=\"contextGeneric\">\n\t\t<div class=\"row\">\n\t\t\t<div class=\"col-2 m-auto\">\n\t\t\t\t<button class=\"boolNode\" id=\"noTest4-out\"><i class=\"fa fa-circle-thin\"></i></button>\n\t\t\t</div>\n\t\t\t<div class=\"col-10 text-left\">\n\t\t\t\t<button type=\"button\" class=\"btn px-5 text-white\">Test1</button>\n\t\t\t\t<button class=\"striNode\" id=\"noTest6-out\"><i class=\"fa fa-circle-thin\"></i></button>\n\t\t\t</div>\n\t\t</div>\n\t\t<div class=\"row\">\n\t\t\t<div class=\"col-2 m-auto\">\n\t\t\t\t<button class=\"striNode\" id=\"noTest5-out\"><i class=\"fa fa-circle-thin\"></i></button>\n\t\t\t</div>\n\t\t\t<div class=\"col-10 text-left\">\n\t\t\t\t<button type=\"button\" class=\"btn px-5 text-white\">Test2</button>\n\t\t\t\t<button class=\"striNode\" id=\"noTest-out\"><i class=\"fa fa-circle-thin\"></i></button>\n\t\t\t\t<button class=\"intNode\" id=\"noTest1-out\"><i class=\"fa fa-circle-thin\"></i></button>\n\t\t\t\t<button class=\"intNode\" id=\"noTest2-out\"><i class=\"fa fa-circle-thin\"></i></button>\n\t\t\t</div>\n\t\t</div>\n</div>");
    $("#contextMenu").addClass("w-500px");

    searchBox = $("#contextSearch");
    getById("contextMenu").style.border = (selectedType ? ("solid " + GetTypeFromLetter(selectedType).colour) : "none") + ";";

    $("#contextSensitive").click(function() {
        ctxSensitive = !ctxSensitive;
        this.classList.remove(ctxSensitive ? "fa-toggle-off" : "fa-toggle-on");
        this.classList.add(ctxSensitive ? "fa-toggle-on" : "fa-toggle-off");
        CommandSearch();
    });
}

$("#Graph").mouseup(function(e) {
    if (e.which > 1 || sweep)
    {
        if (e.target === this)
        {
            e.preventDefault();
            sweep = false;
            if ((e.which == 3) && (Date.now() - start < doubleClickDuration))
            {
                selectedType = null; 
                MakeCommandsMenu();
                CommandSearch();
                ShowContext(e.clientX, e.clientY);
            }
            else
            {
                SaveDocument();
            }
        }
    }
    if (drw)
    {
        drw = false;
        MakeCommandsMenu();
        CommandSearch();
        ShowContext(e.clientX, e.clientY);
    }
    
});

OnOnce($("#Graph"), "touchend", function(e) {
    if (drw)
    {
        bTDrag = false;
        drw = false;
        if (touchtargetelem == this)
        {
            MakeCommandsMenu();
            CommandSearch();
            ShowContext(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
        }
    }
});

$(document).mousemove(function(e) {
    if(hintPopup && hintshowing)
    {
        hintPopup.style.left = e.clientX + 5 + "px";
        hintPopup.style.top = (e.clientY - hintPopup.clientHeight) + "px";
    }
});

const drawsweepspeed = -3;

let allMovers;
function UpdateMovers()
{
    allMovers = graph.getElementsByClassName(draggableClass);
}

UpdateMovers();

function MoveAllNodes(deltaX, deltaY)
{
    for(let elmnt of graph.getElementsByClassName(draggableClass))
    {
        elmnt.style.top = (parseInt(elmnt.style.top) + deltaY) + "px";
        elmnt.style.left = (parseInt(elmnt.style.left) + deltaX) + "px";
    }

    UpdateStaticLines();
}

function SignedPow(x, y)
{
    let sign = Math.min(x, y) < 0 ? -1 : 1;
    return Math.pow(x, y) * sign;
}

function Clamp(x, min, max)
{
    return Math.max(Math.min(x, max), min);
}

let customlinebuffer = [];
let bCustomLines = true;
let customlineX = 0;
let customlineY = 0;

function UpdateCustomLines(x, y)
{
    customlineX = x;
    customlineY = y;
}

function DrawPotentialLine(x, y)
{
    lctx.clearRect(0, 0, width, height);

    lctx.strokeStyle = tempLineStyle;
    lctx.lineWidth = 3;
    lctx.shadowColor = lctx.strokeStyle;

    if (bCustomLines)
    {
        if ((Math.abs(customlineX - x) + Math.abs(customlineY - y)) > linedistance)
        {
            customlinebuffer.push((x - customlineX) + "," + (y - customlineY));
            UpdateCustomLines(x, y);
        }

        DrawCustomLine(lctx, customlinebuffer.join(",,"), lastX, lastY, x, y);
        return;
    }

    lctx.beginPath();
    lctx.moveTo(lastX, lastY);
    lctx.lineTo(x, y);
    lctx.stroke();
}

$("#Graph").mousemove(function (e) {
    if (sweep)
    {
        MoveAllNodes(e.originalEvent.movementX, e.originalEvent.movementY);
        start = 0;
    }

    if (drw && e)
        DrawPotentialLine(e.clientX, e.clientY);
});

let touchtargetelem;

OnOnce($("#Graph"), "touchmove", function (e) {
    const touches = e.changedTouches;

    if (drw)
    {
        touchtargetelem = document.elementFromPoint(touches[0].clientX, touches[0].clientY);
        DrawPotentialLine(touches[0].clientX, touches[0].clientY);
    }

    // preventDefault() is not preventing this code from running so I have to implement a check
    if (e.target !== this) return;

    if (sweep)
    {
        e.preventDefault();
        MoveAllNodes(touches[0].clientX - lastTX, touches[0].clientY - lastTY);
        lastTX = touches[0].clientX;
        lastTY = touches[0].clientY;
        UpdateStaticLines();
        start = 0;
    }
});

function download(data, filename, type) {
    var file = new Blob([data], {type: type});
    if (window.navigator.msSaveOrOpenBlob) // IE10+
        window.navigator.msSaveOrOpenBlob(file, filename);
    else { // Others
        var a = document.createElement("a"),
                url = URL.createObjectURL(file);
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(function() {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }, 0);
    }
}

// Gets the first node that has the same id, used to get the starting node when compiling.
function GetNodeElementFromName(name)
{
    name = name.toLowerCase();
    for (let i of document.getElementsByClassName("zw-Node"))
    {
        if (i.id.substring(0, name.length) == name)
            return new NODEAPI_Node(i.id);
    }
}

function ConvertAll()
{
    let output = "";
    for (let i of Commands[0].nodes)
    {
        reservedvars = 0;
        existing_vars = [];
        collapsedNubs = [];
        collapsedNubNames = [];
        output += GetNodeCode(GetNodeElementFromName(i.name), 0, true, "");
    }

    let functiondef = "";
    for (let i of functionNodes)
    {
        let returntype = i.io.split("o.;")[1].split(";").slice(0, -1);
        if (returntype.length > 1)
        {
            returntype = returntype[1].split(".");
            returntype = returntype[returntype.length - 2];
            returntype = GetTypeFromLetter(returntype).name;
        }
        else
            returntype = "void"

        let inputs = [];
        for (let nub of i.io.split("o.;")[0].split(";").slice(1, -1))
        {
            let nubsplit = nub.split(".");
            inputs.push(GetSetting("param-decl").replaceAll("%name", MakeParameterName(nubsplit[nubsplit.length - 1])).replaceAll("%type", GetTypeFromLetter(nubsplit[nubsplit.length - 2]).name).UnEscape());
        }

        debugger;
        functiondef += GetSetting("function-format").replaceAll("%name", i.name).replaceAll("%return", returntype).replaceAll("%code", Tabify(i.output.UnEscape(), 1)).replaceAll("%inputs", inputs.join(GetSetting("param-separator"))).UnEscape();
    }

    if (functiondef)
        functiondef += "\n";

    output = output.replaceAll("%functions", functiondef);

    if (output.includes("%functions"))
        debugger;

    let addonDeclarations = "";
    for (let setting of eSettings.innerText.split("<br>"))
    {
        if (setting.substring(0, setting.indexOf("=")) == "addon-decl")
            addonDeclarations += setting.substring(setting.indexOf("=") + 1).UnEscape();
    }

    if (addonDeclarations)
        addonDeclarations += "\n";

    return addonDeclarations + output;
}

function ConvertSelected()
{
    if ($(".editor_selected").length)
    {
        const code = GetNodeCode(new NODEAPI_Node($(".editor_selected")[0].id), 0, true, "");

        if (code.includes("%functions"))
            return ConvertAll();

        return code;
    }
    else
        return "- No node is selected -";
}

$("#editor_exportallbtn").click(function() {
    existing_vars = [];
    download(ConvertAll(), "editor_output." + GetSetting("extension"), GetSetting("extension"));
});

$("#editor_exportselbtn").click(function() {
    reservedvars = 0;
    existing_vars = [];
    collapsedNubs = [];
    collapsedNubNames = [];
    download(ConvertSelected(), "editor_output." + GetSetting("extension"), GetSetting("extension"));
});

class editor_module
{
    constructor(name, contents)
    {
        this.name = name;
        this.contents = contents;
    }
}

var editorModules = [];

async function AddModule(file)
{
    let txt = await file.text();
    txt = txt.replaceAll("\r\n", "\n");
    let filename = file.name;

    if (filename.substring(0, 3) == "../")
        filename = filename.substring(3);

    let ext = "_" + filename.substring(filename.lastIndexOf(".") + 1);
    let name = filename.substring(0, filename.lastIndexOf("."));

    if (txt.trim()[0] == "#" && (txt.substring(txt.indexOf("\n") - " Module\n".length, txt.indexOf("\n")) == " Module"))
        name = txt.trim().substring(1, txt.trim().indexOf("\n"));

    name += ext;

    let indexlist = GetModIndex().replaceAll(",,", ",").replaceAll("../", "").split(",");

    if (!indexlist.includes(name))
    {
        indexlist.push(name);
        indexlist = indexlist.filter(function(v, i) {
            return (v !== "");
        });
    }

    localStorage.setItem("editor_moduleindex", indexlist.join(","));
    localStorage.setItem(name, txt);

    UpdateModuleButtons();

    return txt;
}


let width = window.innerWidth;
let height = window.innerHeight;

const nodeWidth = 300;

const acanvas = document.getElementById("allLines");
const bcanvas = document.getElementById("blueLines");

const LINEMODE_LINEAR = 0;
const LINEMODE_BEZIER = 1;

let staticLineMode = 0;

class PanelSetting
{
    constructor(name, type, defaultVal, changef, dependency="")
    {
        this.name = name;
        this.type = type;
        this.defaultVal = defaultVal;
        this.changef = changef
        // dependency is a string of name,value pairs separated by ,,
        // so if this setting needs Line Style to be set to Linear before it's relevant, put in 'Line Style,Linear'
        this.dependency = dependency;
    }
}

const cssRoot = document.querySelector(':root');

function OnHeaderFontChange()
{
    cssRoot.style.setProperty("--header-font", GetPanelSetting("Header Font"));
}

function OnParagraphFontChange()
{
    cssRoot.style.setProperty("--paragraph-font", GetPanelSetting("Paragraph Font"));
}

function OnLightingFXChange()
{
    bBloom = GetPanelSetting("Glow") !== "Off";
    actx.shadowBlur = (GetPanelSetting("Glow") !== "Off") ? 15 : 0;
    lctx.shadowBlur = actx.shadowBlur;

    for (let i of document.getElementsByClassName("zw-Node"))
        UpdateGradients(i.id);

    UpdateStaticLines();
}

function OnThemeChange()
{
    console.log("Changing Theme...");
    let isDark = GetPanelSetting("Theme");
    let nodebg, textcol, nodetitle, tabbg, tabbtnbg, nodeheaderbg, sidepanelbg, gradient0, gradient1, inputbg, ctxheaderbg;

    if (isDark == "Custom")
    {
        nodebg = GetPanelSetting("Node Background");
        textcol = GetPanelSetting("Text Colour");
        nodetitle = GetPanelSetting("Node Title Colour");
        tabbg = GetPanelSetting("Tab Background");
        tabbtnbg = GetPanelSetting("Tab Button Background");
        nodeheaderbg = GetPanelSetting("Node Header Background");
        sidepanelbg = GetPanelSetting("Side-Panel Background");
        gradient0 = GetPanelSetting("Background Gradient 0");
        gradient1 = GetPanelSetting("Background Gradient 1");
    }
    else
    {
        isDark = isDark === "Dark";

        nodebg = isDark ? "black" : "white";
        textcol = isDark ? "white" : "black";
        nodetitle = textcol;
        tabbg = isDark ? "#181818" : "#CCC";
        tabbtnbg = isDark ? "#333" : "#CCC";
        nodeheaderbg = isDark ? "black" : "white";
        sidepanelbg = isDark ? "#222" : "var(--light)";
        gradient0 = isDark ? "black" : "#CEFCFF";
        gradient1 = isDark ? "rgb(10, 23, 40)" : "#84E2FF";
        inputbg = isDark ? "#303035" : "#EEE";
        ctxheaderbg = isDark ? "#111" : "#EEE";
    }

    cssRoot.style.setProperty("--bp-bg-black", gradient0);
    cssRoot.style.setProperty("--bp-bg-blue", gradient1);
    cssRoot.style.setProperty("--node-bg", nodebg);
    cssRoot.style.setProperty("--sidepanel-bg", sidepanelbg);
    cssRoot.style.setProperty("--text-colour", textcol);
    cssRoot.style.setProperty("--node-title-col", nodetitle);
    cssRoot.style.setProperty("--bg-topic", tabbg);
    cssRoot.style.setProperty("--tab-btn-bg", tabbtnbg);
    cssRoot.style.setProperty("--node-top-bg", nodeheaderbg);
    cssRoot.style.setProperty("--input-bg", inputbg);
    cssRoot.style.setProperty("--ctx-header-bg", ctxheaderbg);

    editorTypes[0].colour = isDark ? "#FFFFFF" : "#000000";

    for (let i of document.getElementsByClassName("zw-Node"))
    {
        if (!i.id) continue;

        UpdateGradients(i.id);
        let apinode = new NODEAPI_Node(i.id);
        let puts = []
        puts = puts.concat(apinode.GetInputs());
        puts = puts.concat(apinode.GetOutputs());

        for (let i of puts)
        {
            if (i.element)
            {
                if (i.element.getAttribute("zw-type") == 'e')
                    i.element.parentElement.style.color = isDark ? "white" : "black";
            }
        }

    }
    UpdateStaticLines();
}

function OnOperatorStyleChange()
{
    let apinode;
    let nodesToRespawn = [];
    for (let i of GetNodes())
    {
        apinode = new NODEAPI_Node(i.id);
        if (apinode.node)
        {
            if (apinode.node.type == 4)
                nodesToRespawn.push(i.id);
        }
    }

    for (let i of nodesToRespawn)
    {
        apinode = new NODEAPI_Node(i);
        RespawnNode(getById(i), apinode, apinode.node);
    }
}

let linedistance = 20;

function OnLineResChange()
{
    let val = 100 - GetPanelSetting("Line Resolution");
    linedistance = ((val / 100) * 19) + 1;
}

const panelsettings = [
    new PanelSetting("Line Style", "Linear|Bezier|Drawn", "Bezier", OnLineSettingChange),
    new PanelSetting("Line Resolution", "range", "25", OnLineResChange, "Line Style,Drawn"),
    new PanelSetting("Header Font", "text", "Bebas Neue", OnHeaderFontChange),
    new PanelSetting("Paragraph Font", "text", "PT Sans Narrow", OnParagraphFontChange),
    new PanelSetting("Glow", "On|Off", "On", OnLightingFXChange),
    new PanelSetting("Theme", "Light|Dark|Custom", "Dark", OnThemeChange),
    new PanelSetting("Node Background", "color", "#000000", OnThemeChange, "Theme,Custom"),
    new PanelSetting("Text Colour", "color", "#FFFFFF", OnThemeChange, "Theme,Custom"),
    new PanelSetting("Node Title Colour", "color", "#FFFFFF", OnThemeChange, "Theme,Custom"),
    new PanelSetting("Tab Background", "color", "#181818", OnThemeChange, "Theme,Custom"),
    new PanelSetting("Tab Button Background", "color", "#333333", OnThemeChange, "Theme,Custom"),
    new PanelSetting("Node Header Background", "color", "#000000", OnThemeChange, "Theme,Custom"),
    new PanelSetting("Side-Panel Background", "color", "#222222", OnThemeChange, "Theme,Custom"),
    new PanelSetting("Background Gradient 0", "color", "#000000", OnThemeChange, "Theme,Custom"),
    new PanelSetting("Background Gradient 1", "color", "#0A171E", OnThemeChange, "Theme,Custom"),
    new PanelSetting("Operator Node Style", "Symbol Only|Full Title|Full Node", "Symbol Only", OnOperatorStyleChange),
];

function CallPanelSetting(name)
{
    for (let s of panelsettings)
    {
        if ("setting" + s.name.replaceAll(" ", "-") == name)
        {
            s.changef();
            break;
        }
    }

    SaveSettings();
    UpdateSettingsPanel();
    LoadSettings(true);
    SaveDocument();
}

function getById(id)
{
    return document.getElementById(id);
}

function GetPanelSetting(name)
{
    let e = getById("setting" + name.replaceAll(" ", "-"));
    if (e)
        return e.value;

    return null;
}

function GetPanelSettingStruct(name)
{
    for (let s of panelsettings)
    {
        if (s.name == name)
            return s;
    }
    return null;
}

function SetPanelSetting(name, value, callchangef=true)
{
    let panelstruct = GetPanelSettingStruct(name);
    if (panelstruct)
    {
        let e = getById("setting" + name.replaceAll(" ", "-"));
        if (e)
        {
            e.value = value;

            if (panelstruct.type.includes("|"))
                e.innerHTML = value;


            if (callchangef)
                panelstruct.changef();
        }
    }
}

const panel = getById("editor_settingspanel");

function MakeDropdown(options, defaultVal, name, itemclassname, classname="")
{
    let txt = "<div class=\"dropdown\"><button class=\"btn dropdown-toggle bg-input " + classname + "\" type=\"button\" data-toggle=\"dropdown\" id=\"" + name + "\" value=\"" + defaultVal + "\">-Pick Option-<span class=\"caret\"></span></button><ul class=\"typedropdown dropdown-menu bg-topic\">";
    for (let i of options)
        txt += "<li class=\"editor_dropbtn " + itemclassname + "\" for=\"" + name + "\">" + i + "</li>";

    txt += "</ul></div>";
    return txt;
}

function UpdateGenericDropdowns()
{
    OnOnce($(".editor_genericdropdown"), 'click', function() {
        this.parentElement.previousSibling.value = this.innerHTML;
        this.parentElement.previousSibling.innerHTML = this.innerHTML;
    });
}

function SettingDependencyCheck(dependency)
{
    let name, value;
    for (let d of dependency.split(",,"))
    {
        [name, value] = d.split(",");
        let setting = PanelSettingIsSaved(name);

        name = name.replaceAll(" ", "-");
        if (!setting)
        {
            for (let i of panelsettings)
            {
                if (i.name == name)
                {
                    if (i.defaultVal != value)
                        return false;
                }
            }
            return true;
        }
        if (setting != value)
            return false;
    }

    return true;
}

function UpdateSettingsPanel()
{
    let txt = "";
    let textdefaults = [];
    let safename;

    for (let s of panelsettings)
    {
        safename = s.name.replaceAll(" ", "-");
        if (s.dependency)
        {
            if (!SettingDependencyCheck(s.dependency))
                continue;
        }

        txt += "<div class=\"col-6 p-0 my-auto\"><p>" + s.name + "&#58; </p></div>";

        if (s.type != 'text')
            txt += "<div class=\"col-6 p-0 my-auto\">";
        else
            txt += "<div class=\"col-4 p-0 my-auto\">";

        if (s.type.includes("|"))
            txt += MakeDropdown(s.type.split("|"), s.defaultVal, "setting" + safename, "editor_panelsettingdrop", "btn-block");
        else
            txt += "<input class=\"panelsettinginput w-100\" id=\"setting" + safename + "\" type=\"" + s.type + "\" value=\"" + s.defaultVal + "\">";

        txt += "</div>"

        // Not great but the alternative would be more code duplication
        if (s.type == 'text')
        {
            textdefaults.push([safename, s.defaultVal, s.changef]);
            txt += "<div class=\"col-2 p-0\"><button type=\"button\" for=\"" + safename + "\" class=\"btn btn-bloop editor_settingreset\"><i class=\"fa fa-refresh\"></i></button></div>";

        }
    }
    panel.innerHTML = txt + "</div>";

    for (let t of textdefaults)
    {
        $(".editor_settingreset").off().on('click', function() {
            let panelSetting = GetPanelSettingStruct(this.getAttribute("for").replaceAll("-", " "));
            this.parentElement.previousElementSibling.childNodes[0].value = panelSetting.defaultVal;
            panelSetting.changef();
            SaveSettings();
        });
    }

    $(".panelsettinginput").off().on('change', function() {
        CallPanelSetting(this.id);
    });

    $(".editor_panelsettingdrop").off().on('click', function() {
        getById(this.getAttribute("for")).value = this.innerHTML;
        getById(this.getAttribute("for")).innerHTML = this.innerHTML;
        CallPanelSetting(this.getAttribute("for"));
    });
}

function LineTo_Linear(ctx, start, end, startpoint, endpoint)
{
    ctx.moveTo(start[0], start[1]);
    ctx.lineTo(end[0], end[1]);
}

function LineTo_Bezier(ctx, start, end, startpoint, endpoint)
{
    ctx.moveTo(start[0], start[1]);
    ctx.bezierCurveTo(startpoint[0], startpoint[1], endpoint[0], endpoint[1], end[0], end[1]);
}

let LineToFunc = LineTo_Linear;

function OnLineSettingChange()
{
    bCustomLines = false;
    switch (GetPanelSetting("Line Style"))
    {
        case "Bezier":
            LineToFunc = LineTo_Bezier;
            break;
        case "Drawn":
            bCustomLines = true;
        default:
            LineToFunc = LineTo_Linear;
            break;
    }

    UpdateStaticLines();
}

function lerp(x, y, blend)
{
    return ((y - x) * blend) + x;
}

function HalfwayPoint(v1, v2)
{
    return [lerp(v1[0], v2[0], 0.5), lerp(v1[1], v2[1], 0.5)];
}

// A band-aid to make sure broken or missing connections are fixed.
// I tried to write it so I wouldn't need this, but unfortunately it does.
function FixAllConnections()
{
    for (let i of graph.getElementsByClassName("zw-arrow"))
    {
        for (let j of SafeGetAttribute(i, "zw-link").split(","))
        {
            let otherElement = getById(j);

            if (!otherElement)
            {
                i.zw_RemoveLink(j);
                continue;
            }

            if (!otherElement.zw_HasLink(i.id))
                otherElement.zw_AddLink(i.id);
        }
    }
}

function DrawCustomLine(ctx, positionlist, startX, startY, endX, endY)
{
    // the positionlist is a string of x,y coordinates, separated by ,,
    // so the syntax is x1,y1,,x2,y2,,
    // they are all delta coordinates, starting at the input nub's position

    let coord;

    ctx.beginPath();
    ctx.moveTo(startX, startY);
    let prevX = startX;
    let prevY = startY;
    let nextX, nextY;

    for (let i of positionlist.split(",,"))
    {
        coord = i.split(",");
        nextX = prevX + parseInt(coord[0]);
        nextY = prevY + parseInt(coord[1]);
        ctx.lineTo(nextX, nextY);
        [prevX, prevY] = [nextX, nextY];
    }

    ctx.lineTo(endX, endY);
    ctx.stroke();
}

let bBloom = true;

function UpdateStaticLines()
{
    actx.clearRect(0, 0, width, height);

    for (let arrow of graph.querySelectorAll(".zw-arrow[id*=\"-in\"]"))
    {
        //if (!arrow.id.includes("-in")) continue;

        let tcol = NodeColourFromLetter(arrow.getAttribute('zw-type'));

        if (!tcol)
        {
            debugger;
            continue;
        }

        for (let thId of SafeGetAttribute(arrow, 'zw-link').split(","))
        {
            let thNode = document.getElementById(thId);

            // Another band-aid fix I was hoping I wouldn't have to do
            if (!thNode)
            {
                arrow.zw_RemoveLink(thId);
                continue;
            }

            let thStyle = NodeColourFromLetter(thNode.getAttribute('zw-type'));
            if (bBloom) actx.shadowColor = thStyle;
            let myPos = GetPositionOfNode(arrow);
            let thPos = GetPositionOfNode(thNode);

            let distance = Math.sqrt(((myPos[0] - thPos[0]) ** 2) + ((myPos[1] - thPos[1]) ** 2));
            distance *= 0.5;

            if (tcol !== thStyle.toLowerCase())
            {
                let grad = actx.createLinearGradient(myPos[0], myPos[1], thPos[0], thPos[1]);
                grad.addColorStop(0.25, tcol);
                grad.addColorStop(0.75, thStyle);
                actx.strokeStyle = grad;
            }
            else
                actx.strokeStyle = tcol;

            let customlines = (arrow.getAttribute('zw-type') != 'e') ? arrow.getAttribute("customline") : thNode.getAttribute("customline");

            if (bCustomLines && customlines)
            {
                DrawCustomLine(actx, customlines, thPos[0], thPos[1], myPos[0], myPos[1]);
                continue;
            }

            actx.beginPath();
            LineToFunc(actx, myPos, thPos, [myPos[0] - distance, myPos[1]], [thPos[0] + distance, thPos[1]]);
            actx.stroke();
        }
    }
}

$("#editor_docfuncbtn").click(function() {
    LoadDocument(baseDocumentName);
});

function ModuleInStorage(name)
{
    let sep = GetModIndex() ? "," : "";
    let index = GetBModIndex() + sep + GetModIndex();
    if (index)
    {
        for (let i of index.split(","))
        {
            if (i.trim() == name)
                return true;
        }
    }

    return false;
}

class editor_modal
{
    constructor(title, inputs)
    {
        this.title = title;
        this.inputs = inputs;
    }
}

const modalTitle = document.getElementById("editor_modal-title");
const modalBody = document.getElementById("editor_modal-body");
var responseThread;

function MakeTypeOptions()
{
    let types = [];
    for (let t of editorTypes.slice(1))
    {
        if (t.icons[0])
            types.push(t.name);
    }
    return types;
}

function MakeTypeDropdown()
{
    
    let html = "<div class=\"dropdown d-inline\"><button class=\"btn btn-primary dropdown-toggle editor_modalinput\" id=\"editor_picktypebtn\" type=\"button\" data-toggle=\"dropdown\">Pick Type\n  <span class=\"caret\"></span></button>\n  <ul class=\"dropdown-menu bg-dark typedropdown\">";
    html += "<li class=\"editor_typebtn editor_dropbtn\">void</li>";
    for (let t of editorTypes.slice(1))
    {
        if (t.icons[0] && t.output)
            html += "<li class=\"editor_typebtn editor_dropbtn\">" + t.name + "</li>";
    }
    html += "</ul>\n</div>";
    return html;
}

function AskForFile(onAnswer)
{
    $("#openfiledialog").off().on('change', onAnswer);
    $("#openfiledialog").click();
}

const NewVarModal = new editor_modal("New Variable", [["Name", "newvar_name", "text"], ["Type", "newvar_type", "type"]]);
const NewFuncModal = new editor_modal("New Function", [["Name", "newfunc_name", "text"]]);
const ChangeColModal = new editor_modal("Change Type Colour", [["New Colour", "changecol_newcolour", "color"]]);


function TriggerModal(m, fnc)
{
    modalTitle.innerText = m.title;
    let contents = "";
    for (let i of m.inputs)
    {
        for (let str of i)
        {
            for (let char of "<>\"%")
            {
                if (str.includes(char))
                    return;
            }
        }
        let j = i[2].split(",");
        switch (j[j.length - 1])
        {
            case "button":
                contents += "<button type=\"button\" class=\"btn btn-bloop btn-block\" id=\"" + i[1] + "\">" + i[0] + "</button><br>";
                break;
            case "type":
                contents += "<label class=\"mr-3 my-3\" for=\"" + i[1] + "\">" + i[0] + "&#58;</label>" + MakeTypeDropdown() + "<br>";
                break;
            case "delete":
                contents = contents.substring(0, contents.length - 4) + "<button type=\"button\" id=\"" + i[1] + "\" class=\"btn btn-zdanger mx-4 " + i[3] + "\"><i class=\"fa fa-trash\"></i></button><br>";
                break;
            default:
                contents += "<label class=\"mr-3 my-3\" for=\"" + i[1] + "\">" + i[0] + "&#58;</label> <input class=\"editor_modalinput " + i[3] + "\" type=\"" + i[2] + "\" id=\"" + i[1] + "\" name=\"" + i[1] + "\"><br>";
                break;
        }
        if (j[0] == 'array')
            contents += "<input class=\"editor_addInput\">+</input>";
    }
    modalBody.innerHTML = contents;
    $(".editor_typebtn").off().on('click', function() {
        $("#editor_picktypebtn").html(this.innerText);
    });
    $("#editor_modalsubmit").off().on('click', function() {
        fnc($(".editor_modalinput"));
    });
    $("#editorModal").modal();
}

const moduleList = document.getElementById("editor_modules");

const addModuleBtnHTML = "<div class=\"col-12 p-0\"><button id=\"editor_addmodulevbtn\" class=\"btn btn-bloop btn-block\">Add Module (.hmodule, .json, .module)</button><input hidden type=\"file\" id=\"editor_addmodulebtn\" name=\"editor_addmodulebtn\"></input></div>";

function MakeGenericBtn(text, id="", href="")
{
    let out = "<div class=\"col-12 p-0\">";

    if (href) out += "<a href=\"" + href + "\">";
    out += "<button type=\"button\" class=\"btn btn-bloop btn-block\"";
    if (id)
        out += " id=\"" + id + "\"";
    out += ">" + text;
    out += "</button>";
    if (href) out += "</a>";

    out += "</div>";
    return out;
}

const moduleName = getById("editor_currentModuleText");

function ReopenAddonMenu()
{
    $("#editor_modalsubmit").click();
    $("#editor_addonsmenu").click();
}

function RefreshModuleButtons()
{
    $("#editor_addmodulebtn").off().on('change', function() {
        if ('files' in this)
        {
            for (let f of this.files)
                AddModule(f);
        }
    });

    OnOnce($("#editor_addonsmenu"), 'click', function() {
        let language = moduleName.innerHTML;
        let addons = GetAddonsFromLang(GetLanguage());
        let inputs = [];
        if (addons)
        {
            for (let i of addons)
                inputs.push([i[0], "editor_addonenable_" + i[1], "checkbox", "editor_addoncheck"], ["deletebtn", "editor_addondelete_" + i[1], "delete", "editor_addondelete"]);
        }

        inputs.push(["Add Library (.hmodule)", "editor_addaddon", "button"]);

        TriggerModal(new editor_modal(language + " Libraries", inputs), function() {
            ReloadModule();
        });

        for (let i of document.getElementsByClassName("editor_addoncheck"))
            i.checked = GetAddonEnabled(i.id.substring("editor_addonenable_".length));

        $(".editor_addoncheck").click(function() {
            SetAddonEnabled(this.id.substring("editor_addonenable_".length), this.checked);
        })

        $(".editor_addondelete").click(function() {
            RemoveAddonFromStorage(this.id.substring("editor_addondelete_".length));
            RemoveAddonFromLang(GetLanguage(), this.id.substring("editor_addondelete_".length))
            ReopenAddonMenu();
        });

        OnOnce($("#editor_addaddon"), 'click', function() {
            AskForFile(async function(f) {
                if (f.target.files)
                {
                    let names;
                    for (let i of f.target.files)
                    {
                        names = await NewAddonFromFile(i, GetLanguage());
                        AddAddonToStorage(names[1]);
                    }
                    ReloadModule();
                    ReopenAddonMenu();
                }
            });
        });
    });

    $("#editor_addmodulevbtn").off().on('click', function() {
        $("#editor_addmodulebtn").click();
    });

    $(".editor_modulebtn").off().on('click', function() {
        let thisval = this;
        MakeCustomDialog("Switching Modules", "Switching modules will make a new document, are you sure?", ["Yes", "No"], function(result) {
            if (result === "Yes")
            {
                localStorage.setItem("editor_currentModule", thisval.innerHTML + "_" + thisval.getAttribute("module-type"));
                SetItem(baseDocumentName, "");
                $("#editor_currentModuleText").html(thisval.innerHTML);
                NewDocument(false);
                ReloadModule();
                NewDocument(false);
            }
        });

    });
    $(".editor_deletemodulebtn").off().on('click', function() {
        let moduleToDelete = this.getAttribute("delete-module");
        localStorage.setItem(moduleToDelete + "_module", "");
        localStorage.getItem("editor_moduleindex")
        localStorage.setItem("editor_moduleindex", GetItem("editor_moduleindex").replace(moduleToDelete, "").replace(",,", ","));
        let txt = localStorage.getItem("editor_moduleindex");
        if (txt.substring(txt.length - 1) == ",")
        {
            SetModIndex(txt.substring(0, txt.length - 1));
        }
        location.reload();
    });
}

function UpdateModuleButtons()
{
    let text = "";
    let sep = (GetModIndex() && GetBModIndex()) ? "," : "";
    let modules = GetBModIndex() + sep + GetModIndex();
    for (let i of modules.split(","))
    {
        if (!i) continue;
        text += "<div class=\"col-10 p-0\"><button type=\"button\" module-type=\"" + i.substring(i.indexOf("_") + 1) + "\" class=\"btn btn-bloop btn-block editor_modulebtn\">" + i.substring(0, i.indexOf("_")) + "</button></div><div class=\"col-2 p-0\"><button type=\"button\" class=\"btn btn-zdanger editor_deletemodulebtn\" delete-module=\"" + i + "\"><i class=\"fa fa-trash\"></i></button></div>";
    }
    text += "<div class=\"col-12\"><br></div>";
    if (GetItem("editor_currentModule") || !isOffline)
    {
        text += MakeGenericBtn("Libraries", "editor_addonsmenu");
    }
    text += addModuleBtnHTML;
    text += MakeGenericBtn("Module Documentation", "", "docs#creating-modules");
    moduleList.innerHTML = text;

    RefreshModuleButtons();
}

internalModules = ["C.hmodule", "CSharp.hmodule", "JavaScript.module", "NodeLanguage.hmodule", "PHP.hmodule", "Python.json", "StructuredText.hmodule"]

let isOffline = false;

async function LoadLocalModules()
{
    let file;
    let txt;
    let bmoddex = [];

        for (let m of internalModules)
        {
            try {
                file = await fetch(m);
            }
            catch(err) {
                isOffline = true;
            }
            // Can't break inside the catch so I'm resorting to this
            if (isOffline) break;

            txt = (await file.text()).replaceAll("\r\n", "\n");
            file.name = m;
            if ((txt.trim().substring(0, 2) == "//") && (txt.substring(txt.indexOf("\n") - " Module".length, txt.indexOf("\n")) == " Module"))
                bmoddex.push(txt.trim().substring(2, txt.trim().indexOf(" Module")).trim() + "_" + m.substring(m.lastIndexOf(".") + 1));
            else
                bmoddex.push(m.replace(".", "_"));
            localStorage.setItem(bmoddex[bmoddex.length - 1], txt);
        }


    SetBModIndex(bmoddex.join(","));
}

function LoadVariables()
{
    if (GetItem("editor_variables"))
    {
        for (let i of GetItem("editor_variables").split(","))
        {
            editorVars.push(new editorVariable(i.split(".")[0], GetTypeFromLetter(i.split(".")[1]).name));
        }
    }
}

function SaveVariables()
{
    let newvars = "";
    for (let i of editorVars)
    {
        if (i.name)
        {
            newvars += i.name + "." + i.type + ",";
        }
    }
    newvars = newvars.substring(0, newvars.length - 1)
    SetItem("editor_variables", newvars);
}

function RemoveVariable(variableName)
{
    for (let i of editorVars)
    {
        if (i.name == variableName)
        {
            editorVars.splice(editorVars.indexOf(i), 1);
            break;
        }
    }

    SaveVariables();
    RefreshVars();
}

function ClearSettings()
{
    for (let s of panelsettings)
        SetItem("diazoprints_setting_" + s.name.replaceAll(" ", "-"), "");
}

function SaveSettings()
{
    for (let s of panelsettings)
    {
        let setting = GetPanelSetting(s.name);
        if (setting !== null)
            SetItem("diazoprints_setting_" + s.name.replaceAll(" ", "-"), setting);
    }
}

function PanelSettingIsSaved(setting)
{
    return GetItem("diazoprints_setting_" + setting.replaceAll(" ", "-"));
}

function LoadSettings(callchangef=true)
{
    let s;

    for (let panelsetting of panelsettings)
    {
        s = PanelSettingIsSaved(panelsetting.name);
        SetPanelSetting(panelsetting.name, s ? s : panelsetting.defaultVal, callchangef);
    }
}

function GetLanguage()
{
    return moduleName.innerHTML
}

function AddAddonToStorage(name)
{

    let storageaddons = GetItem("editor_addons_" + GetLanguage());

    if (storageaddons)
        storageaddons = JSON.parse(storageaddons);
    else
        storageaddons = [];

    if (!storageaddons.includes(name))
        storageaddons.push(name);

    SetItem("editor_addons_" + GetLanguage(), JSON.stringify(storageaddons));
}

function RemoveAddonFromStorage(name)
{
    let storageaddons = GetItem("editor_addons_" + GetLanguage());

    if (!storageaddons) return;

    storageaddons = JSON.parse(storageaddons);
    let addon
    for (let i = 0; i < storageaddons.length; i++)
    {
        addon = storageaddons[i];
        if (addon == name)
        {
            storageaddons.splice(i, 1);
            SetItem("editor_addons_" + GetLanguage(), JSON.stringify(storageaddons));
            return;
        }
    }
}

function GetAddonsFromStorage()
{
    let storageaddons = GetItem("editor_addons_" + GetLanguage());
    if (storageaddons)
        return JSON.parse(storageaddons);
    return [];
}

function NewAddon(displayname, name, lang)
{
    AddEditorAddon(lang, displayname, name);
}

function AddAddonItem(name, contents)
{
    SetItem("editor_addon_" + name, contents);
}

function GetAddonItem(name)
{
    return GetItem("editor_addon_" + name);
}

function SetAddonEnabled(name, bEnabled)
{
    SetItem("editor_addonenable_" + name, bEnabled.toString())
}

function GetAddonEnabled(name)
{
    return GetItem("editor_addonenable_" + name) !== 'false';
}

async function NewAddonFromFile(file, lang)
{
    let txt = (await file.text()).replaceAll("\r\n", "\n");
    let name = file.name.replaceAll(".", "_");
    AddAddonItem(name, txt);
    let displayname = name;
    if (txt.trim().substring(0, 2) == "//")
    {
        displayname = txt.trim().substring(2, txt.trim().indexOf("\n")).trim();
    }
    AddEditorAddon(lang, displayname, name);
    return [displayname, name];
}

function AddAddonLang(lang)
{
    for (let i of editor_addons)
    {
        if (i.lang == lang)
        {
            return;
        }
    }
    editor_addons.push({lang: lang, addons:[]});
}

let editor_addons = [
];

function AddEditorAddon(lang, displayname, itemname)
{
    for (let i of editor_addons)
    {
        if (i.lang == lang)
        {
            i.addons.push([displayname, itemname]);
            return;
        }
            
    }
    editor_addons.push({lang: lang, addons: [[displayname, itemname]]});
}

const builtinaddons = [["C", "standard_library_string.hmodule", "standard_library_stdio.hmodule", "standard_library_stdint.hmodule", "standard_library_stdlib.hmodule", "standard_library_time.hmodule", "standard_library_math.hmodule", "standard_library_wctype.hmodule", "standard_library_threads.hmodule"], ["C#", "dotnet_api_system.hmodule", "dotnet_api_system_text.hmodule"], ["Python", "python_math.hmodule", "python_random.hmodule"]];

async function ResetAddons()
{
    if (!isOffline)
    {
        for (let i of builtinaddons)
        {
            for (let j of i.slice(1))
            {
                let f = await fetch("addons/" + j);
                f.name = j.replaceAll(".", "_");
                await NewAddonFromFile(f, i[0]);
            }
        }
    }


    for (let i of GetAddonsFromStorage())
    {
        if (i)
            AddEditorAddon(GetLanguage(), i, i);
    }
}

function LoadAddons()
{
    let loadingaddons = GetAddonsFromLang(GetLanguage());
    for (let addon of loadingaddons)
    {
        if (GetAddonEnabled(addon[1]))
            LoadModuleFromHeaderFile(GetAddonItem(addon[1]));
    }
}

function SetupCanvases()
{
    width = window.innerWidth;
    height = window.innerHeight;
    acanvas.setAttribute("width", width);
    acanvas.setAttribute("height", height);
    bcanvas.setAttribute("width", width);
    bcanvas.setAttribute("height", height);
    actx.shadowOffsetX = 0;
    actx.shadowOffsetY = 0;
    lctx.shadowOffsetX = 0;
    lctx.shadowOffsetY = 0;
    actx.shadowBlur = 15;
    lctx.shadowBlur = 15;
    actx.lineWidth = 3;
    lctx.lineWidth = 3;
    UpdateStaticLines();
}

function ReloadModule()
{
    usedIds = [];
    Commands[0].nodes = [];
    Commands[1].nodes = [];
    Commands[unsortedIndex].nodes = [];
    Commands.splice(unsortedIndex + 1);
    editorTypes = [];
    ResetEditorTypes();
    eSettings.innerText = "";
    currentCategory = unsortedIndex;
    editorStructs = [];
    zLegend.innerHTML = "";
    LoadModuleFromUnknown(GetItem("editor_currentModule"));
    LoadAddons();
    OnThemeChange();
}

// The fetch API can't be used when you use the web-app offline
async function CheckIfOffline()
{
    try {
        let testfetch = await fetch("addons/standard_library_stdlib.hmodule");
        return true;
    }
    catch(err) {
        return false;
    }
}

window.onload = function() {
    CheckIfOffline().then(function(b) {

    if (!b)
    {
        // Offline Mode
        UpdateModuleButtons();

        let moduletext = GetItem("editor_currentModule")
        if (moduletext)
        {
            $("#editor_currentModuleText").html(moduletext.substring(0, moduletext.indexOf("_")));
            LoadModuleFromUnknown(GetItem("editor_currentModule"));
            LoadAddons();
        }
        else
        {
            $("#editor_currentModuleText").html("No Module Loaded");
        }
        LoadVariables();
        RefreshVars();
        LoadFunctions();
        UpdateFunctionButtons();
        LoadDocument();

        UpdateSettingsPanel();
        LoadSettings();
        refreshGraph();
        UpdateClickables();
        return;
    }

    let moduletext = GetItem("editor_currentModule");
    if (moduletext)
        $("#editor_currentModuleText").html(moduletext.substring(0, moduletext.indexOf("_")));
    else
        $("#editor_currentModuleText").html("JavaScript");

    $("#LoadingScreenDetail").html("Fetching Built-In Modules...");
    LoadLocalModules().then(function() {
        UpdateModuleButtons();

        if (GetLaunchInSafeMode())
        {
            document.getElementById("editor_version").innerHTML = "Safe Mode";
            moduleList.innerHTML += MakeGenericBtn("Exit Safe Mode", "editor_exit_safemode", "");
            RefreshModuleButtons();

            $("#editor_exit_safemode").click(function() {
                SetLaunchInSafeMode(false);
                location.reload();
            });

            currentDocument = "editor_safemode_temporarydocument";
            $("#LoadingScreenDetail").html("Fetching Built-In Libraries...");
            ResetAddons().then(function() {
                UpdateSettingsPanel();
                LoadSettings();
                refreshGraph();
                UpdateClickables();
                $("#LoadingScreen")[0].remove();
            });
            return;
        }

        if (GetItem("editor_currentModule"))
        {
            $("#LoadingScreenDetail").html("Fetching Built-In Libraries...");
            ResetAddons().then(function() {
                $("#LoadingScreenDetail").html("Loading Module...");
                LoadModuleFromUnknown(GetItem("editor_currentModule"));
                LoadAddons();

                UpdateSettingsPanel();
                LoadSettings();
                if (GetItem(baseDocumentName))
                {
                    LoadVariables();
                    RefreshVars();
                    LoadFunctions();
                    UpdateFunctionButtons();
                    LoadDocument();
                }
                else
                    NewDocument(false);

                LoadTypeOverrides();
                StartTick();
                refreshGraph();
                UpdateClickables();
                RefreshCmdBtns();
                SetupCanvases();
            });
        }
        else
        {
            console.log("No Current Module...");
            SetItem("editor_currentModule", "JavaScript_module");

            $("#LoadingScreenDetail").html("Fetching Built-In Addons...");
            ResetAddons().then(function() {
                $("#LoadingScreenDetail").html("Loading Module...");
                LoadModuleFromText(GetItem("JavaScript_module"));

                LoadAddons();

                UpdateSettingsPanel();
                LoadSettings();
                LoadTypeOverrides();

                LoadExampleDocument();
                refreshGraph();
                RefreshCmdBtns();
                UpdateClickables();
                StartTick();
                SetupCanvases();
            });
        }
    });
    });
};
