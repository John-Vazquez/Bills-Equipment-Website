function searchItems() {
    const searchTerm = document.getElementById('search-input').value;
    console.log('Searching for:', searchTerm);
    // Future implementation: filter items based on searchTerm
}

// button clicked funtion controls the relevant, price ascending, price descending, and rating buttons
function buttonClicked(button) {

    // checks if clicked button is already selected (has checkmark and black background)
    if (button.style.backgroundColor === "black" && button.innerHTML.includes("✓")) {
        // resets the clicked button to default style
        button.style.backgroundColor = "#f2f0ef";
        button.style.color = "black";
        button.innerHTML = button.innerHTML.replace("✓ ", "");
    } 

    else {
        
        // Deselect all buttons in the flex container
        const buttons = document.querySelectorAll(".flex-container button");
        buttons.forEach(btn => {
            btn.style.backgroundColor = "#f2f0ef";
            btn.style.color = "black";
            btn.innerHTML = btn.innerHTML.replace("✓ ", "");
        });

        // Set the clicked button as selected
        button.style.backgroundColor = "black";
        button.style.color = "#f2f0ef";
        button.innerHTML += "✓ ";
    }
}

// button clicked funtion controls the keywords buttons
function buttonKeywords(button) {

    // checks if keyword button is clicked (there's an x)
    if (button.innerHTML.includes("×"))
        button.innerHTML = button.innerHTML.replace(" ×", "");

    // keyword button isn't clicked
    else
        button.innerHTML += " ×";
}