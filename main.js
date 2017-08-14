
async function make_request(url, responseType) {
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

    request.onerror = function() {
      reject(Error('Network Error'));
    }
    request.onreadystatechange = function() {
      if(request.readyState == 4 && request.status == 401) {
          reject('You must be logged in to JIRA to see this project.');
      }
    }

    request.send();
  });
}

function getJIRAFeed(callback, errorCallback) {
    var user = document.getElementById('user').value;
    if(user == undefined) return;

    var url = 'https://jira.secondlife.com/activity?maxResults=50&streams=user+IS+'+user+'&providers=issues';
    make_request(url, '').then(function(response) {
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
async function getQueryResults(searchTerm, callback, errorCallback) {
  try {
    var response = await make_request(searchTerm, 'json');
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
  var callbackBase = 'https://jira.secondlife.com/rest/api/2/search?jql=';
  var project = document.getElementById('project').value;
  var status = document.getElementById('statusSelect').value;
  var inStatusFor = document.getElementById('daysPast').value;
  var fullCallbackUrl = callbackBase;
  fullCallbackUrl += 'project='+project+'+and+status='+status+'+and+status+changed+to+'+status+'+before+-'+inStatusFor+'d&fields=id,status,key,assignee,summary&maxresults=100';
  callback(fullCallbackUrl);
}

function createHTMLElementResult(response) {
  
  var issuesTable = document.createElement('table');
  var issues = response.issues;

  issues.forEach(function(issue) {
    var issueRow = document.createElement('tr');
    var issueData = document.createElement('td');

    var statusImage = document.createElement('img');
    statusImage.src = issue.fields.status.iconUrl;

    var issueDataSummaryDiv = document.createElement('div');
    
    issueDataSummaryDiv.innerHTML += 'Summary: ' + issue.fields.summary;
    issueDataSummaryDiv.innerHTML += '<br>Status: ' + issue.fields.status.name;
    
    issueDataSummaryDiv.appendChild(statusImage);

    issueDataSummaryDiv.innerHTML += '<br>Description: ' + issue.fields.status.description;

    if (issue.fields.assignee === null) {
      issueDataSummaryDiv.innerHTML += '<br>Assignee: None';
    } else {
      issueDataSummaryDiv.innerHTML += '<br>Assignee: ' + issue.fields.assignee.name;
    }

    issueData.appendChild(issueDataSummaryDiv);
    issueData.style.border = '1px solid black';
    issueData.style.padding = '1.5rem 1.5rem 1.5rem 1.5rem';

    issueRow.appendChild(issueData);
    issuesTable.appendChild(issueRow);
  });
  
  return issuesTable;
}

function domify(str) {
  var dom = (new DOMParser()).parseFromString('<!doctype html><body>' + str,'text/html');
  return dom.body.textContent;
}

function checkProjectExists() {
    try {
      return make_request('https://jira.secondlife.com/rest/api/2/project/SUN', 'json');
    } catch (errorMessage) {
      document.getElementById('status').innerHTML = 'ERROR. ' + errorMessage;
      document.getElementById('status').hidden = false;
    }
}

/**
 * When the Query button is clicked the query is built and the results are
 * fetched then the results are rendered.
 */
function queryClickHandler() {
  buildJQL(function(url) {
    document.getElementById('status').innerHTML = 'Performing JIRA search for ' + url;
    document.getElementById('status').hidden = false;

    getQueryResults(url, function(return_val) {

      document.getElementById('status').innerHTML = 'Query term: ' + url + '\n';
      document.getElementById('status').hidden = true;

      var jsonResultDiv = document.getElementById('query-result');
      jsonResultDiv.appendChild(return_val);
      jsonResultDiv.hidden = false;

    }, function(errorMessage) {
        document.getElementById('status').innerHTML = 'ERROR. ' + errorMessage;
        document.getElementById('status').hidden = false;
    });
  });
}

/**
 * Fetches the XML JIRA feed and renders the result
 */
function activityFeedClickHandler() {
  getJIRAFeed(function(url, xmlDoc) {
    document.getElementById('status').innerHTML = 'Activity query: ' + url + '\n';
    document.getElementById('status').hidden = false;

    // render result
    var feed = xmlDoc.getElementsByTagName('feed');
    var entries = feed[0].getElementsByTagName('entry');
    var list = document.createElement('ul');

    entries.forEach(function(entry) {
      var title = entry.getElementByTagName('title')[0].innerHTML;
      var updated = entry.getElementsByTagName('updated')[0].innerHTML;
      var listItem = document.createElement('li');

      listItem.innerHTML = new Date(updated).toLocaleString() + ' - ' + domify(title);
      list.appendChild(listItem);
    });

    var feedResultDiv = document.getElementById('query-result');

    if(list.childNodes.length > 0) {
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

/**
 * Setup listeners for buttons. 
 * Query click handler
 */
function setupListeners() {
  document.getElementById('query').onclick = queryClickHandler;
  document.getElementById('feed').onclick = activityFeedClickHandler;
}

/**
 * Setup: If logged in then setup listeners for the query and feed handlers.
 */
document.addEventListener('DOMContentLoaded', function() {
    checkProjectExists().then(function() {
      loadOptions();
      setupListeners();
    }).catch(function(errorMessage) {
        document.getElementById('status').innerHTML = 'ERROR. ' + errorMessage;
        document.getElementById('status').hidden = false;
    });
});
