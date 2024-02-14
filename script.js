let boxes = document.querySelectorAll('.box');
let resetBtn = document.querySelector('#reset');
let player1Name = document.querySelector('#player1');
let player2Name = document.querySelector('#player2');
let player1 = prompt("Enter Player 1 name");
let player2 = prompt("Enter Player 2 name");

player1Name.innerHTML = player1;
player2Name.innerHTML = player2;

let playerOScore = 0;
let playerXScore = 0;

let playerO = true;

const possibilities = [
    [0, 1, 2],
    [0, 3, 6],
    [0, 4, 8],
    [1, 4, 7],
    [2, 5, 8],
    [2, 4, 6],
    [3, 4, 5],
    [6, 7, 8]
];

boxes.forEach((box) => {
    box.addEventListener('click', () => {
        if (playerO) {
            // console.log("O");
            box.innerHTML = "O";
            playerO = false;
        } else {
            // console.log("X");
            box.innerHTML = "X";
            playerO = true;
        }
        box.disabled = true;

        checkWinner();
    })

});

resetBtn.addEventListener('click', () => {
    boxes.forEach((box) => {
        box.disabled = false;
        box.innerHTML = '';
    });
    // Reset scores
    playerOScore = 0;
    playerXScore = 0;
    updateScores();
})


const checkWinner = () => {
    for (let possibility of possibilities) {
        if (boxes[possibility[0]].innerHTML !== '' && boxes[possibility[1]].innerHTML !== '' && boxes[possibility[2]].innerHTML !== '') {
            if (boxes[possibility[0]].innerHTML === boxes[possibility[1]].innerHTML && boxes[possibility[1]].innerHTML === boxes[possibility[2]].innerHTML) {
                if (boxes[possibility[1]].innerHTML === "O") {
                    playerOScore++;
                    alert(`${player1} Wins`);
                    reset();
                } else {
                    playerXScore++;
                    alert(`${player2} Wins`);
                    reset();
                }
                updateScores();
            }
        }
    }
}

const reset = () => {
    boxes.forEach((box) => {
        box.disabled = false;
        box.innerHTML = '';
    })
}

const updateScores = () => {
    player1Name.innerHTML = `${player1} (${playerOScore})`;
    player2Name.innerHTML = `${player2} (${playerXScore})`;
}
