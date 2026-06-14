// To make smarter nodes that change their output based on what they are given, I've decided to write a basic interpreter to make programmable nodes.

// Basically instead of simply outputing what's in the node, it's now treated as code that returns the output as a string.
// For the most safety, I designed my own simplistic language instead of simply allowing you to write JavaScript.

// It's only got variables, ifs, returns, and ways to access information about the nubs. Math is like JavaScript, where + can be used to concatenate strings.

// Available math expressions: +, -, *, /
// Available compare expressions: >, >=, <, <=, ==, !=
// Available boolean expressions: &&, ||, !

// Each nub can be accessed with it's name.
/*
    param_1; // Returns param_1.keyword normally, but inside an if will return param_1.isdef

    param_1.name // Returns 'param_1'. Not very useful, it's for the interpreter.
    param_1.type // Returns the name of the type of the nub
    param_1.isdef // Returns whether or not the nub is connected to a node.
    param_1.keyword // Returns the keyword used to access the parameter in the function, such as '%0' or '%1'
*/

// Examples:
/*
    if (param_1)
    {
        return param_1;
    }

    return "NULL";
*/
// Result: %0 when the param_1 nub is connected, otherwise NULL

console.log("NodeLang v1.0");

class InterpreterKeyword
{
    constructor(name, type, isdefined, keyword)
    {
        this.name = name;
        this.type = type;
        this.isdef = isdefined;
        this.keyword = keyword;
    }
}

function SplitStatements(script)
{
    let output = [""];
    let depth = 0;
    let bString = false;
    for (char of script)
    {
        if (char == "\"")
        {
            bString = !bString;
        }
        if (!bString)
        {
            if (";{}".includes(char))
            {
                output.push(char);
                output.push("");
                continue;
            }
        }
        output[output.length - 1] += char;
    }
    return output;
}

function CheckStatement(statement, text)
{
    return (text.substring(0, statement.length) == statement) && (" \t".includes(text[statement.length]));
}

class InterpreterOperator
{
    constructor(op, func)
    {
        this.op = op;
        this.func = func;
    }
}

const operators = [
    new InterpreterOperator("+", function(a, b) {return a + b}),
    new InterpreterOperator("-", function(a, b) {return a - b}),
    new InterpreterOperator("*", function(a, b) {return a * b}),
    new InterpreterOperator("/", function(a, b) {return a / b}),
    new InterpreterOperator("<", function(a, b) {return a < b}),
    new InterpreterOperator(">", function(a, b) {return a > b}),
    new InterpreterOperator("<=", function(a, b) {return a <= b}),
    new InterpreterOperator(">=", function(a, b) {return a >= b}),
    new InterpreterOperator("==", function(a, b) {return a == b}),
    new InterpreterOperator("!=", function(a, b) {return a != b}),
    new InterpreterOperator("&&", function(a, b) {return a && b}),
    new InterpreterOperator("||", function(a, b) {return a || b})
];

const singletonoperators = [
    new InterpreterOperator("!", function(a) {return !a})
];

class InterpreterVariable
{
    constructor(name, value)
    {
        this.name = name;
        this.value = value;
    }
}

let InterpreterVariables = [];

function InterpretFuller(keywordss, inputs, outputs, as_bool=false)
{
    let list = NodeLanguage_BreakdownMath(keywordss);

    if (list.length == 1) return InterpretFull(list[0], inputs, outputs, as_bool ? "isdef" : "keyword");

    for (let i = 0; i < list.length; i++)
    {
        if (!(i % 2))
        {
            for (let o of singletonoperators)
            {
                if (list[i].toString().trim() == o.op)
                {
                    list.splice(i, 2, o.func(InterpretFull(list[i + 1].toString().trim(), inputs, outputs, as_bool ? "isdef" : "keyword")));

                    if ((list.length > 1) && (typeof(list[i]) === 'string'))
                            list[i] = "\"" + list[i] + "\"";

                    break;
                } 
            }
        }
        else
        {
            for (let o of operators)
            {
                if (list[i].toString().trim() == o.op)
                {
                    list.splice(i - 1, 3, o.func(InterpretFull(list[i - 1].toString().trim(), inputs, outputs, as_bool ? "isdef" : "keyword"), InterpretFull(list[i + 1].trim(), inputs, outputs, as_bool ? "isdef" : "keyword")));

                    if ((list.length > 1) && (typeof(list[i - 1]) === 'string'))
                        list[i - 1] = "\"" + list[i - 1] + "\"";

                    i--;
                    break;
                } 
            }
        }

    }

    return list[0];
}

function InterpretFull(keywords, inputs, outputs, defaultval="")
{
    //keywords = keywords.trim();

    if (keywords[0] == "\"" && keywords[0] == keywords[keywords.length - 1])
    {
        return keywords.substring(1, keywords.length - 1);
    }

    let keys = keywords.split(".");

    let base = InterpretKeyword(keys[0].trim(), inputs, outputs);

    if (!base)
    {
        for (let i of InterpreterVariables)
        {
            if (i.name == keys[0])
            {
                base = new InterpreterKeyword(i.name, "variable", i.value ? true : false, i.value);
                break;
            }
        }

        if (!base)
            return keywords;
    }

    if (keys.length > 1)
    {
        if (!base[keys[1].trim()]) debugger;
        return base[keys[1].trim()].toString();
    }

    if (defaultval)
        return base[defaultval];

    return base.format;
}

function InterpretKeyword(keyword, inputs, outputs)
{
    keyword = keyword.trim();

    // inputs and outputs are arrays of InterpreterKeywords
    for (let i of inputs)
    {
        if (i.name == keyword)
            return i;
    }

    for (let i of outputs)
    {
        if (i.name == keyword)
            return i;
    }

    return false;
}

const TestInputs = [new InterpreterKeyword("param_1", "exec", true, "%0"), new InterpreterKeyword("param_2", "int", false, "%1")];
const TestOutputs = [new InterpreterKeyword("out_1", "exec", false, "%o0")];

const interprettestbtn = document.getElementById("interpret_testing_btn");
const interprettestinput = document.getElementById("interpret_testing_input");
const interprettestoutput = document.getElementById("interpret_testing_output");

const operatorsymbols = "+-=*/<>!&|";

function NodeLanguage_BreakdownMath(string)
{
    let outputs = [""];
    let isOp = false;
    let wasOp = operatorsymbols.includes(string.substring(0, 1));
    let bString = false;
    for (char of string)
    {
        if (char === "\"") bString = !bString;

        if (bString)
        {
            outputs[outputs.length - 1] += char;
            continue;
        }

        isOp = operatorsymbols.includes(char);
        if (isOp !== wasOp)
        {
            outputs.push(char);
            wasOp = isOp;
            continue;
        }
        wasOp = isOp;
        outputs[outputs.length - 1] += char;
    }
    return outputs;
}

function NodeLanguage_CountTabs(line)
{
    line = line.replaceAll("\t", "    ");
    let tabs = 0;
    while (line.substring(0, 1) == " ")
    {
        tabs++;
        line = line.substring(1);
    }
    return tabs;
}

function NodeLanguage_GetVariable(name)
{
    for (let i of InterpreterVariables)
    {
        if (i.name == name)
        {
            return i.value;
        }
    }
    return "undefined";
}

function NodeLanguage_SetVariable(name, value)
{
    for (let i = 0; i < InterpreterVariables.length; i++)
    {
        InterpreterVariables[i].value = value;
        if (InterpreterVariables[i].name == name)
        {
            InterpreterVariables[i].value = value;
            return true;
        }
    }
    return false;
}

function NodeLanguage_Interpret(script, inputs, outputs)
{
    InterpreterVariables = [];

    let statements = SplitStatements(script);
    let statement = ""
    for (let s = 0; s < statements.length; s++)
    {
        statement = statements[s].trim();

        if (statement.includes("//"))
            statement = statement.substring(0, statement.indexOf("//"));

        for (let o of ["+=", "-=", "*=", "/=", "&&=", "||="])
        {
            if (statement.includes(o))
            {
                statement = statement.split(o);
                statement = statement[0] + " = " + statement[0] + " " + o[0] + " " + statement[1];
            }
        }

        if (!statement || ";{}".includes(statement)) continue;

        if (CheckStatement("if", statement))
        {
            let val = statement.substring(statement.indexOf("(") + 1, statement.indexOf(")"));
            if (!InterpretFuller(val.trim(), inputs, outputs, true))
                s = statements.indexOf("}", s);
            continue;
        }

        if (CheckStatement("return", statement))
        {
            return InterpretFuller(statement.substring("return ".length).trim(), inputs, outputs);
        }

        let leftside = statement.substring(0, statement.indexOf("=")).trim();
        let rightside = statement.substring(statement.indexOf("=") + 1).trim();
        rightside = InterpretFuller(rightside, inputs, outputs);

        let forceNew = false;
        if (["let", "var"].includes(leftside.split(" ")[0]))
        {
            forceNew = true;
            leftside = leftside.substring(leftside.indexOf(" ") + 1).trim();
        }

        if (forceNew || !NodeLanguage_SetVariable(leftside, rightside))
            InterpreterVariables.push(new InterpreterVariable(leftside, rightside));
    }
    return "No return statement found";
}

$("#interpret_testing_btn").click(function() {
    interprettestoutput.innerText = NodeLanguage_Interpret(interprettestinput.value, TestInputs, TestOutputs);
});
