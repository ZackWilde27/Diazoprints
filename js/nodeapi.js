/////////////////////////////////////////////////////////
//
// NODE API
//
/////////////////////////////////////////////////////////

class NODEAPI_Node
{
    constructor(id)
    {
        this.element = document.getElementById(id);
        if (!this.element)
        {
            this.name = "";
            return;
        }
        this.name = GetNodeTitle(this.element);

        for (let i of Commands)
        {
            for (let x of i.nodes)
                {
                    if (x.name == this.name)
                    {
                        this.node = x;
                        break;
                    }
                }
        }
        if (this.node === undefined)
        {
            for (let i of functionNodes)
            {
                if (i.name == this.name)
                {
                    this.node = i;
                    break;
                }
            }
        }
    }

    GetValue()
    {
        if (this.node.type == 3)
            return this.node.output.replace("%", this.element.getElementsByClassName("editor_input")[0].value);
        return this.element.getElementsByClassName("editor_input")[0].value;
    }

    GetInputs()
    {
        let ins = 0;
        let inn = [];
        while ($("#" + this.element.id + "-in" + ins).length)
        {
            inn.push(new NODEAPI_Nub(this.element.id + "-in" + ins));
            ins++;
        }
        ins--;
        return inn;
    }

    GetOutputs()
    {
        let outs = 0;
        let outn = [];

        while ($("#" + this.element.id + "-out" + outs).length)
        {
            outn.push(new NODEAPI_Nub(this.element.id + "-out" + outs));
            outs++;
        }
        outs--;
        return outn;
    }
};

class NODEAPI_Nub {
    constructor(id)
    {
        this.element = document.getElementById(id);
        this.attachedNode = this.element.getAttribute("zw-link");
        this.attachedNub = document.getElementById(this.attachedNode);
        if (this.attachedNode)
        {
            this.attachedNode = new NODEAPI_Node(this.attachedNode.substring(0, this.attachedNode.indexOf("-")));
        }
        this.type = zLetterCodes[zCols.indexOf(this.element.style.color)];
        
    }
};

const EXECUTION_NODE = 0;
const STANDARD_NODE = 1;
const MICRO_NODE = 2;
const INPUT_NODE = 3;
const MACRO_NODE = 4;
const PROGRAMMABLE_NODE = 5;

function Tabify(text, depth)
{
    return text.padStart(text.length + depth, "\t").replaceAll("\n", "\n".padEnd(depth + 1, "\t"));
}

function MakeDeclaration(name, type)
{
    return GetSetting("var-decl").replaceAll("%name", name).replaceAll("%type", type);
}


let currentNode;


const fallbackvalue = "";

function GetNodeCode_HandlePut(node, puts, i, bArray=false)
{
    if (!puts[i]) return "";

    if (!puts[i].element) debugger;

    if (puts[i].element.classList.toString().includes("editor_input"))
    {
        let nubdef = node.node.io.split("o.;")[0].split(";")[i].split(".");
        nubdef = nubdef[nubdef.length - 2];
        return GetTypeFromLetter(nubdef).output.replaceAll("%", puts[i].element.value);
    }

    if (puts[i].attachedNub)
    {
            if ((puts[i].element.getAttribute("z-val") === "EDITORARRAY") && !bArray)
            {
                tags = [];
                for (let j = i; j < puts.length; j++)
                {
                    tags.push(GetNodeCode_HandlePut(node, puts, j, true));
                }
                return tags.join(GetSetting("array-separator"));
            }

            if (puts[i].attachedNub.getAttribute("z-val"))
            {
                let cval = puts[i].attachedNub.getAttribute("z-val");
                if (cval.includes("%"))
                    cval = GetNodeCode_HandleInputs(puts[i].attachedNode, cval, 0);
                return cval;
            }


            return GetNodeCode(puts[i].attachedNode, 0, false, fallbackvalue, parseInt(puts[i].attachedNub.id.substring(puts[i].attachedNub.id.indexOf("-out") + "-out".length)));
    }
    else
    {
        nub = node.node.io.split("o.;")[0].split(";")[i].split(".");
        if (nub[0] === "p")
            return nub[1];
        else
            return fallbackvalue;
    }
}

function GetNodeCode_HandleOutput(node, outputs, i, bArray=false)
{
    if (!outputs[i]) return "";

    return GetNodeCode_HandlePut(node, outputs, i);
}

function GetNodeCode_HandleInput(node, inputs, i, bArray=false)
{
    if (!inputs[i]) return "";

    // If this nub's type is exec, that is almost certain to cause an infinite loop, so the page will warn about it
    if (inputs[i].type === 'e')
    {
        if (!confirm('An execution nub is being treated as an input, which is almost certain to cause the page to freeze. Do you want to continue?'))
            return;
    }

    return GetNodeCode_HandlePut(node, inputs, i);
}

let collapsedNubs = [];
let collapsedNubNames = [];

// It's set when a Return node is given a value, which if a function is being compiled, indicates it's not a void function.
let voidfunctionflag = false;

function GetNodeCode_HandleInputs(node, format, start=0)
{
    let inputs = node.GetInputs();
    if (InFunction() && (GetNodeTitle(node.element) == "Return"))
    {
        if (inputs[1].attachedNub)
            voidfunctionflag = inputs[1].attachedNub.getAttribute("zw-type");
    }
    let output = format.replace(" ", " "); // Making sure it's a copy
    for (let i = start; i < inputs.length; i++)
    {
        if (!output.includes("%" + (i - start)))
            continue;

        output = output.replaceAll("%" + (i - start), GetNodeCode_HandleInput(node, inputs, i));
    }
    return output;
}

function GetNodeCode_HandleOutputs(node, format, start=0, fallback=fallbackvalue)
{
    let outputs = node.GetOutputs();

    let bval = GetNodeCode_HandleNew(node, format, outputs);
    let fmt = "";

    if (bval.includes("%o") || bval.includes("%s") || bval.includes("%c"))
    {
        for (let i = start; i < outputs.length; i++)
        {
            let next = bval.search(new RegExp("\\%[osc]" + i));
            if (next !== -1)
            {
                if (!outputs[i].attachedNub)
                {
                    bval = bval.replaceAll("%" + bval[next + 1] + i, fallback);
                    continue;
                }

                if (outputs[i].attachedNub.getAttribute("z-val"))
                    fmt = outputs[i].attachedNub.getAttribute("z-val");

                switch (bval[next + 1])
                {
                    case "s":
                        bval = bval.replaceAll("%s" + i, GetNodeCode(outputs[i].attachedNode, 0, false, fallback, 0, fmt));
                        break;
                    case "o":
                        bval = bval.replaceAll("%o" + i, Tabify(GetNodeCode(outputs[i].attachedNode, 0, true, fallback, 0, fmt), 1));
                        break;
                    case "c":
                        bval = bval.replaceAll("%c" + i, GetNodeCode(outputs[i].attachedNode, 0, true, fallback, 0, fmt));
                        break;
                }
            }
        }
    }
    return bval;
}


const functiondocument = document.getElementById("functiondocument");


// This one reads the outputs
function GetFunctionNub(name, index)
{
    let node = new NODEAPI_Node(GetNodes()[1].id);

    if (node.element)
    {
        let inputs = node.GetInputs();
        if (inputs[index].attachedNub)
        {
            let nodecode = GetNodeCode(inputs[index].attachedNode);

            for (let i = 0; nodecode.includes("%\\" + i); i++)
                nodecode.replaceAll("%\\" + i, "%" + i);

            return nodecode;
        }
    }
    return "";
}


function GetFunctionExec(name, index)
{
    let node = new NODEAPI_Node(GetNodes()[0].id);

    if (node.element)
    {
        let outputs = node.GetOutputs();
        if (outputs[index].attachedNub)
        {
            let nodecode = GetNodeCode(outputs[index].attachedNode);
            for (let i = 0; nodecode.includes("%\\" + i); i++)
                nodecode.replaceAll("%\\" + i, "%" + i);

            return nodecode;
        }
    }
    return "";
}

class TakenIterator
{
    constructor(element, iterator)
    {
        this.element = element;
        this.iterator = iterator;
    }
}

const takenIterators = [];
let currentIterator = 0;

function IteratorName(element)
{
    let valid;

    for (const i of "ijklmnopqrstuvwxyzabcdefgh")
    {
        valid = true;
        for (const taken of takenIterators)
        {
            if (taken.iterator === i)
            {
                valid = false;
                break;
            }
        }

        if (valid)
        {
            takenIterators.push(new TakenIterator(element, i));
            return i;
        }
    }
}

function RemoveIterators(element)
{
    for (let i = 0; i < takenIterators.length; i++)
    {
        if (takenIterators[i].element === element)
        {
            takenIterators.splice(i, 1);
            i--;
            break;
        }
    }
}

function GetNodeCode_HandleNew(node, bval, outputs)
{
    if (bval.includes("%n"))
    {
        for (let i = 0; i < outputs.length; i++)
        {
            if (outputs[i].element.hasAttribute("diazo_reservedvariable"))
            {
                if (!outputs[i].element.getAttribute("z-val"))
                    outputs[i].element.setAttribute("z-val", IteratorName(node.element));

                const variableName = MakeVariableName(outputs[i].element.getAttribute("z-val"));
                bval = bval.replaceAll("%nt", variableName);
                bval = bval.replace("%n", MakeDeclaration(variableName, GetTypeFromLetter(outputs[i].element.getAttribute("zw-type")).name));
                bval = bval.replaceAll("%n", variableName);
            }
        }
    }
    return bval;
}

function GetEditorVariable(name)
{
    for (let i of editorVars)
    {
        if (i.name == name)
            return i;
    }
}



function GetNodeCode(node, depth=0, includeNext=true, fallback=fallbackvalue, nubdex=0, fmt="")
{
    let lineseparator = GetSetting("separator").replaceAll("\\n", "\n");
    if (!node) return fallback;
    if (node.element.getAttribute("editor_nooutput") === 'true') return "%c0";
    let out = "";
    let bval = "";
    currentNode = node.element;
    if (!fmt)
    {
        switch (node.node.type)
        {
            case "6":
            case "8":
                let inputsdef = [];
                let end = node.node.io.split("o.;")[0].split(";").slice(1, -1).length;
                for (let i = 0; i < end; i++)
                    inputsdef.push("%" + i);

                bval = inputsdef.join(GetSetting("param-separator"));
                fmt = GetSetting("function-call").replaceAll("%name", node.node.name).replaceAll("%inputs", bval);
                break;
            case "7":
                debugger;
                fmt = MakeAssign(node.node.output, GetTypeFromLetter(GetEditorVariable(node.node.output).type).name, "%0", true);
                break;
            default:
                fmt = node.node.output;
                break;
        }
    }
    try
    {
        switch (parseInt(node.node.type))
        {
            case 0:
            case 6:
            case 7:
                let outputs = node.GetOutputs();
                if (fmt.includes("%"))
                {
                    bval = GetNodeCode_HandleInputs(node, fmt, 1);
                    bval = GetNodeCode_HandleOutputs(node, bval, 1) + lineseparator;

                    if (includeNext)
                        bval += GetNodeCode(outputs[0].attachedNode, 0);

                    out += bval;
                }
                else
                {
                    out += fmt + lineseparator;

                    if (includeNext && outputs[0].attachedNub)
                        out += GetNodeCode(outputs[0].attachedNode, 0);
                }
                break;

            case 3:
                out += node.GetValue();
                break;

            case 5:
                let inputs = [];
                let nodeinputs = node.GetInputs();
                let nub;
                for (let i = 0; i < nodeinputs.length; i++)
                {
                    nub = node.node.io.split("o.;")[0].split(";")[i].split(".");
                    inputs.push(new InterpreterKeyword(nub[nub.length - 1].trim().replaceAll(" ", "_"), GetTypeFromLetter(nodeinputs[i].element.getAttribute("zw-type")).name, nodeinputs[i].attachedNub ? true : false, "\"%" + i + "\""));
                }
                let keywords = [];
                let nodeoutputs = node.GetOutputs();
                for (let i = 0; i < nodeoutputs.length; i++)
                {
                    nub = node.node.io.split("o.;")[1].split(";")[i].split(".");
                    keywords.push(new InterpreterKeyword(nub[nub.length - 1].trim().replaceAll(" ", "_"), GetTypeFromLetter(nodeoutputs[i].element.getAttribute("zw-type")).name, nodeoutputs[i].attachedNub ? true : false, "\"%o" + i + "\""));
                }

                out += GetNodeCode_HandleOutputs(node, GetNodeCode_HandleInputs(node, NodeLanguage_Interpret(node.node.output, inputs, keywords), 0), 0, fallback);
                break;

            default:
                if (fmt.includes("%"))
                {
                    bval = GetNodeCode_HandleInputs(node, fmt, 0);
                    bval = GetNodeCode_HandleOutputs(node, bval, 0);
                    out += bval;
                }
                else
                    out += fmt;

                break;
        }

        return out;
    }
    catch(err)
    {
        currentNode.classList.add("showerror");
        FocusOnNode(currentNode.id);
        return err;
    }
}
