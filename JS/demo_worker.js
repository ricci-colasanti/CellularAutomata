var i = 0;
var step = 1
function timedCount() {
  i+=step;
  postMessage({type: "count", value:i});
  setTimeout("timedCount()",500);
}

/*
	Note: The important part of the code above is the postMessage() method - 
	which is used to post messages back to the HTML page
*/

onmessage = function(e) {
 	switch (e.data.type) {
    	case "setStep":
     		step = e.data.value;
      		break;
    	case "getStep":
      		postMessage({ type: "step", value: step });
      		break;
     }
};


timedCount(); 
