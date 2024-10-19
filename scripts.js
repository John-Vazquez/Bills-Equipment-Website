function searchItems() {
    const searchTerm = document.getElementById('search-input').value;
    console.log('Searching for:', searchTerm);
    // Future implementation: filter items based on searchTerm
}

// button changes color from light grey to black and vice versa when clicked
function buttonClicked(button) {
    var button = document.getElementById("toggle-button");
    
    // toggle between light gray and black
    if (button.style.backgroundColor === "rgb(204, 204, 204)") {
        button.style.backgroundColor = "black";
        button.innerHTML += " &#10004;";
    } else {
        button.style.backgroundColor = "#ccc";
        button.innerHTML = button.innerHTML.replace(" &#10004;", "");
    }
}