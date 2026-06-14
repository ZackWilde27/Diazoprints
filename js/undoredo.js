class UR_History
{
    constructor(undoer, redoer)
    {
        this.undoer = undoer;
        this.redoer = redoer;
    }
}

let editor_history = [
];

let present = -1;

function UR_AddMove()
{
    //present = editor_history.push([]) - 1;
}

const HISTORY_MAX = 50;

function UR_AddAction(undoer, redoer)
{
    present = editor_history.push(new UR_History(undoer, redoer)) - 1;
    if (editor_history.length > HISTORY_MAX)
        editor_history = editor_history.slice(-HISTORY_MAX);
}

function UR_Undo()
{
    let e;
    if (present > -1)
    {
        debugger;
        let h = editor_history[present];
        eval(h.undoer);

        present -= 1;
    }
}

function UR_Redo()
{
    if (present < editor_history.length - 1)
    {
        present += 1;
        
        let h = editor_history[present];
        eval(h.redoer);
    }
}
