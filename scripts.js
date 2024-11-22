// RENTALS AND PRODUCTS HTML
// RENTALS AND PRODUCTS HTML
// RENTALS AND PRODUCTS HTML

function searchItems() {
	const searchTerm = document.getElementById("search-input").value;
	console.log("Searching for:", searchTerm);
	// Future implementation: filter items based on searchTerm
}

// button clicked funtion controls the relevant, price ascending, price descending, and rating buttons
function buttonClicked(button) {
	// Toggle the 'active' class on the clicked button
	if (button.classList.contains("active")) {
		button.classList.remove("active"); // Remove active class if already active
	} else {
		button.classList.add("active"); // Add active class if not already active
	}
}

// This function controls the keyword/tag button
function buttonKeywords(button) {
	if (button.classList.contains("active")) {
		// If it's already active, remove the class and remove the checkmark
		button.classList.remove("active");
		button.innerHTML = button.innerHTML.replace(" ✓", "");
	} else {
		// If it's not active, add the 'active' class and add the checkmark
		button.classList.add("active");
		button.innerHTML += " ✓";
	}
}

// slider function handles the price range slider
function slider() {
	const rangeInput = document.querySelectorAll(".range-input input");
	const progress = document.querySelector(".slider .progress");

	progress.style.display = "none";

	rangeInput.forEach((input) => {
		input.addEventListener("input", (e) => {
			let minVal = parseInt(rangeInput[0].value);
			let maxVal = parseInt(rangeInput[1].value);

			progress.style.display = "block";

			progress.style.left = (minVal / rangeInput[0].max) * 100 + "%";
			progress.style.right = 100 - (maxVal / rangeInput[1].max) * 100 + "%";
		});
	});
}
slider();
