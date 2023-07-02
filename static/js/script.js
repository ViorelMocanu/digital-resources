const menuTrigger = document.getElementById('menuTrigger');
const body = document.body;
menuTrigger.addEventListener('click', function (event) {
	event.preventDefault();
	body.classList.toggle('ActiveMenu');
	return false;
});