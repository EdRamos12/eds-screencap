var p = document.querySelector('.preview');
var resize = document.querySelector('.preview .resize');
var startY, startHeight;

function initDrag(e) {
    startY = e.clientY;
    startHeight = parseInt(document.defaultView.getComputedStyle(p).height, 10);
    document.documentElement.addEventListener('mousemove', doDrag, false);
    document.documentElement.addEventListener('mouseup', stopDrag, false);
}

function doDrag(e) {
    if ((startHeight + e.clientY - startY) >= 50) {
        p.style.height = (startHeight + e.clientY - startY) + 'px';
    }
}

function stopDrag() {
    document.documentElement.removeEventListener('mousemove', doDrag, false); 
    document.documentElement.removeEventListener('mouseup', stopDrag, false);
}

resize.addEventListener('mousedown', initDrag, false);