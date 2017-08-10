
function make_request(url, responseType) {
  return new Promise(function(resolve, reject) {
    var request = new XMLHttpRequest();
    request.open('GET', url);
    request.responseType = responseType;

    request.onload = function() {
      var response = responseType ? request.response : request.responseXML;
      if(response && response.errorMessages && response.errorMessages.length > 0) {
        reject(response.errorMessages[0]);
        return;
      }
      resolve(response);
    };

    // Handle network errors
    request.onerror = function() {
      reject(Error("Network Error"));
    }
    request.onreadystatechange = function() {
      if(request.readyState == 4 && request.status == 401) {
          reject("You must be logged in to JIRA to see this project.");
      }
    }

    // Make the request
    request.send();
  });
}

function getJIRAFeed(callback, errorCallback) {
    var user = document.getElementById("user").value;
    if(user == undefined) return;

    var url = "https://jira.secondlife.com/activity?maxResults=50&streams=user+IS+"+user+"&providers=issues";
    make_request(url, "").then(function(response) {
      // empty response type allows the request.responseXML property to be returned in the makeRequest call
      callback(url, response);
    }, errorCallback);
}

/**
 * @param {string} searchTerm - Search term for JIRA Query.
 * @param {function(string)} callback - Called when the query results have been  
 *   formatted for rendering.
 * @param {function(string)} errorCallback - Called when the query or call fails.
 */
function getQueryResults(searchTerm, callback, errorCallback) {
    try {
      var response = make_request(searchTerm, "json");
      callback(createHTMLElementResult(response));
    } catch (error) {
      errorCallback(error);
    }
}

function loadOptions() {
  chrome.storage.sync.get({
    project: 'Sunshine',
    user: 'nyx.linden'
  }, function(items) {
    document.getElementById('project').value = items.project;
    document.getElementById('user').value = items.user;
  });
}

function buildJQL(callback) {
  var callbackBase = "https://jira.secondlife.com/rest/api/2/search?jql=";
  var project = document.getElementById("project").value;
  var status = document.getElementById("statusSelect").value;
  var inStatusFor = document.getElementById("daysPast").value;
  var fullCallbackUrl = callbackBase;
  fullCallbackUrl += 'project=${project}+and+status=${status}+and+status+changed+to+${status}+before+-${inStatusFor}d&fields=id,status,key,assignee,summary&maxresults=100';
  callback(fullCallbackUrl);
}

function createHTMLElementResult(response) {

// 
// Create HTML output to display the search results.
// results.json in the "json_results" folder contains a sample of the API response
// hint: you may run the application as well if you fix the bug. 
// 

  return '<p>There may be results, but you must read the response and display them.</p>';
}

function domify(str) {
  var dom = (new DOMParser()).parseFromString('<!doctype html><body>' + str,'text/html');
  return dom.body.textContent;
}

function checkProjectExists() {
    try {
      return make_request("https://jira.secondlife.com/rest/api/2/project/SUN", "json");
    } catch (errorMessage) {
      document.getElementById('status').innerHTML = 'ERROR. ' + errorMessage;
      document.getElementById('status').hidden = false;
    }
}



/**
 * Setup: If logged in then setup listeners for the query and feed handlers.
 */
document.addEventListener('DOMContentLoaded', function() {
  // if logged in, setup listeners
    checkProjectExists().then(function() {
      //load saved options
      loadOptions();

      // query click handler
      document.getElementById("query").onclick = function() {
        // build query
        buildJQL(function(url) {
          document.getElementById('status').innerHTML = 'Performing JIRA search for ' + url;
          document.getElementById('status').hidden = false;
          // perform the search
          getQueryResults(url, function(return_val) {
            // render the results
            document.getElementById('status').innerHTML = 'Query term: ' + url + '\n';
            document.getElementById('status').hidden = false;
            
            var jsonResultDiv = document.getElementById('query-result');
            jsonResultDiv.innerHTML = return_val;
            jsonResultDiv.hidden = false;

          }, function(errorMessage) {
              document.getElementById('status').innerHTML = 'ERROR. ' + errorMessage;
              document.getElementById('status').hidden = false;
          });
        });
      }

      // activity feed click handler
      document.getElementById("feed").onclick = function() {
        // get the xml feed
        getJIRAFeed(function(url, xmlDoc) {
          document.getElementById('status').innerHTML = 'Activity query: ' + url + '\n';
          document.getElementById('status').hidden = false;

          // render result
          var feed = xmlDoc.getElementsByTagName('feed');
          var entries = feed[0].getElementsByTagName("entry");
          var list = document.createElement('ul');

          entries.forEach(function(entry) {
            var title = entry.getElementByTagName('title')[0].innerHTML;
            var updated = entry.getElementsByTagName("updated")[0].innerHTML;
            var listItem = document.createElement('li');

            listItem.innerHTML = new Date(updated).toLocaleString() + " - " + domify(title);
            list.appendChild(listItem);
          });

          var feedResultDiv = document.getElementById('query-result');
          if(list.childNodes.length > 0){
            feedResultDiv.innerHTML = list.outerHTML;
          } else {
            document.getElementById('status').innerHTML = 'There are no activity results.';
            document.getElementById('status').hidden = false;
          }
          
          feedResultDiv.hidden = false;

        }, function(errorMessage) {
          document.getElementById('status').innerHTML = 'ERROR. ' + errorMessage;
          document.getElementById('status').hidden = false;
        });
      };

    }).catch(function(errorMessage) {
        document.getElementById('status').innerHTML = 'ERROR. ' + errorMessage;
        document.getElementById('status').hidden = false;
    });
});
