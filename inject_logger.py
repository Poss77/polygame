with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

logger_script = '''
<script>
(function() {
    function sendLog(type, msg) {
        var req = new XMLHttpRequest();
        req.open('POST', 'http://localhost:8080/log', true);
        req.setRequestHeader('Content-Type', 'application/json');
        req.send(JSON.stringify({type: type, msg: msg}));
    }
    var oldLog = console.log;
    console.log = function() {
        sendLog('log', Array.from(arguments).join(' '));
        oldLog.apply(console, arguments);
    };
    var oldError = console.error;
    console.error = function() {
        sendLog('error', Array.from(arguments).join(' '));
        oldError.apply(console, arguments);
    };
    var oldWarn = console.warn;
    console.warn = function() {
        sendLog('warn', Array.from(arguments).join(' '));
        oldWarn.apply(console, arguments);
    };
    window.addEventListener('error', function(e) {
        sendLog('window.error', e.message + ' at ' + e.filename + ':' + e.lineno);
    });
    window.addEventListener('unhandledrejection', function(e) {
        sendLog('unhandledrejection', e.reason ? e.reason.toString() : 'Unknown rejection');
    });
})();
</script>
'''

if 'sendLog(' not in html:
    html = html.replace('<head>', '<head>\n' + logger_script)
    with open('index.html', 'w', encoding='utf-8') as f:
        f.write(html)
