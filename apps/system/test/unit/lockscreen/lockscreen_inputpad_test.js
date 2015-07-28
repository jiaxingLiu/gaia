 /* global LockScreenInputpad */
'use strict';

requireApp('system/shared/test/unit/mocks/mock_settings_listener.js');
requireApp('system/lockscreen/js/lockscreen_inputpad.js');

var mocks = new window.MocksHelper([
  'SettingsListener'
]).init();

suite('LockScreenInputpad', function() {
  var subject;
  var mockLockScreenFacade;
  var mockGetElementById;
  mocks.attachTestHelpers();
  setup(function() {
    mockGetElementById = sinon.stub(window.document, 'getElementById',
    function() {
      var elem = document.createElement('div');
      elem.querySelector = function() {
        return document.createElement('div');
      };
      return elem;
    });
    mockLockScreenFacade = {};
    subject = new LockScreenInputpad(mockLockScreenFacade);
    var stub = sinon.stub(subject, 'toggleEmergencyButton');
    subject.start();
    stub.restore();
  });

  teardown(function() {
    mockGetElementById.restore();
  });

  test('Emergency call: should disable when has no telephony', function() {
    navigator.mozTelephony = null;
    subject.passcodePad = document.createElement('div');
    subject.passcodePad.innerHTML = `<a data-key="e">`;
    subject.emergencyCallBtn =
      subject.passcodePad.querySelector('a[data-key=e]');
    subject.toggleEmergencyButton();
    assert.isTrue(subject.passcodePad.querySelector('a[data-key=e]')
      .classList.contains('disabled'));
  });

  test('Emergency call: should enable when has telephony', function() {
    navigator.mozTelephony = {
      calls: {
        length: 1
      }
    };
    subject.passcodePad = document.createElement('div');
    subject.passcodePad.innerHTML = `<a data-key="e">`;
    subject.emergencyCallBtn =
      subject.passcodePad.querySelector('a[data-key=e]');
    subject.toggleEmergencyButton();
    assert.isFalse(subject.passcodePad.querySelector('a[data-key=e]')
      .classList.contains('disabled'));
  });

  suite('InputPad key helper functions >', function() {

    var MockHtml;

    setup(function () {
      MockHtml = document.createElement('html');
      MockHtml.appendChild(document.createElement('div'));
      var html =
      MockHtml.firstChild.innerHTML = `<a role="key" href="#" data-key="2" ` +
        `class="row0"><div>2<span>ABC</span></div></a>`;
    });

    test('find the correct anchor element for click targets', function () {
      var method = subject._anchorForTarget;
      var a = MockHtml.firstChild.firstChild;  // the anchor to find
      assert.isTrue(a === method(a),
        'anchor detection fails for a level 0 click target');
      assert.isTrue(a === method(a.firstElementChild),
        'anchor detection fails for a level 1 click target');
      assert.isTrue(a === method(a.firstElementChild.firstElementChild),
        'anchor detection fails for a level 2 click target');
      // The tested method currently only supports up to 2nd-level
      // children and we don't really care if it supports more.
      assert.isNull(method(MockHtml),
        'anchor detection fails unexpectedly for top element');
      assert.isNull(method(MockHtml.firstElementChild),
        'anchor detection fails unexpectedly for non-keypad element');
    });

    test('decorate active keys with CSS classes', function() {
      var a = MockHtml.firstChild.firstChild;  // the anchor to find
      var activeClass = 'active-key';
      a.classList.remove(activeClass);
      subject._makeKeyActive(a);
      assert.isTrue(a.classList.contains(activeClass),
        'do not mark key anchor active with CSS class');
      subject._makeKeyInactive(a);
      assert.isFalse(a.classList.contains(activeClass),
        'do not mark key anchor inactive by removing CSS class');
    });

  });

  suite('updatePassCodeUI >', function() {
    test('it would add passcode-entered class while passcode entered',
    function() {
      var method = subject.updatePassCodeUI;
      var mockSubject = {
        states: {
          passCodeEntered: 'foo'
        },
        passcodePad: document.createElement('div'),
        passcodeCode: document.createElement('div')
      };
      method.apply(mockSubject);
      assert.isTrue(mockSubject.passcodePad
        .classList.contains('passcode-entered'),
        'passcode-entered class not added when one is entered');
    });

    test('it would clear passcode-entered class while no passcode entered',
    function() {
      var method = subject.updatePassCodeUI;
      var mockSubject = {
        states: {
          passCodeEntered: ''
        },
        passcodePad: document.createElement('div'),
        passcodeCode: document.createElement('div')
      };
      mockSubject.passcodePad.classList.add('passcode-entered');
      method.apply(mockSubject);
      assert.isFalse(mockSubject.passcodePad
        .classList.contains('passcode-entered'),
        'passcode-entered class not removed when none is entered');
    });

    test('it would set error class during error timeout state',
      function() {
        var method = subject.updatePassCodeUI;
        var mockSubject = {
          states: {
            passCodeEntered: '',
            passCodeErrorTimeoutPending: true
          },
          passcodePad: document.createElement('div'),
          passcodeCode: document.createElement('div')
        };
        method.apply(mockSubject);
        assert.isTrue(mockSubject.passcodeCode
          .classList.contains('error'),
          'error class was not added during error timeout');
      });

    test('it would clear error class when not in error timeout state',
      function() {
        var method = subject.updatePassCodeUI;
        var mockSubject = {
          states: {
            passCodeEntered: '',
            passCodeErrorTimeoutPending: false
          },
          passcodePad: document.createElement('div'),
          passcodeCode: document.createElement('div')
        };
        mockSubject.passcodeCode.classList.add('error');
        method.apply(mockSubject);
        assert.isFalse(mockSubject.passcodeCode
          .classList.contains('error'),
          'error class was not cleared outside error timeout');
      });
  });

  suite('Events >', function() {
    suite('passcode-validationfailed >', function() {
      var stubUpdatePassCodeUI;
      setup(function() {
        stubUpdatePassCodeUI =
          sinon.stub(subject, 'updatePassCodeUI');
      });
      test('event would update the UI', function() {
        subject.handleEvent(
          new CustomEvent('lockscreen-notify-passcode-validationfailed'));
        assert.isTrue(stubUpdatePassCodeUI.called,
          '|updatePassCodeUI| method wasn\'t called');
      });
      test('sets error timeout state', function() {
        subject.states.passCodeErrorTimeoutPending = false;
        subject.handleEvent(
          new CustomEvent('lockscreen-notify-passcode-validationfailed'));
        assert.isTrue(subject.states.passCodeErrorTimeoutPending === true,
          'error timeout state was not set');
      });
      teardown(function() {
        stubUpdatePassCodeUI.restore();
      });
    });

    suite('passcode-validationsuccess >', function() {
      var stubUpdatePassCodeUI;
      setup(function() {
        stubUpdatePassCodeUI =
          sinon.stub(subject, 'updatePassCodeUI');
      });
      test('it would reset UI', function() {
        subject.handleEvent(
          new CustomEvent('lockscreen-notify-passcode-validationsuccess'));
        assert.isTrue(stubUpdatePassCodeUI.called,
          '|updatePassCodeUI| method wasn\'t called');
      });
      test('it would reset internal state', function() {
        subject.states.passCodeEntered = 'fooo';
        subject.states.passCodeErrorTimeoutPending = true;
        subject.handleEvent(
          new CustomEvent('lockscreen-notify-passcode-validationsuccess'));
        assert.isTrue(subject.states.passCodeEntered === '',
          'entered pass code was not cleared');
        assert.isTrue(subject.states.passCodeErrorTimeoutPending === false,
          'timeout error state was not cleared');
      });
      teardown(function() {
        stubUpdatePassCodeUI.restore();
      });
    });

    suite('passcode-validationreset >', function() {
      // Currently identical to validationsuccess
      var stubUpdatePassCodeUI;
      setup(function() {
        stubUpdatePassCodeUI =
          sinon.stub(subject, 'updatePassCodeUI');
      });
      test('it would reset UI', function() {
        subject.handleEvent(
          new CustomEvent('lockscreen-notify-passcode-validationreset'));
        assert.isTrue(stubUpdatePassCodeUI.called,
          '|updatePassCodeUI| method wasn\'t called');
      });
      test('it would reset internal state', function() {
        subject.states.passCodeEntered = 'fooo';
        subject.states.passCodeErrorTimeoutPending = true;
        subject.handleEvent(
          new CustomEvent('lockscreen-notify-passcode-validationreset'));
        assert.isTrue(subject.states.passCodeEntered === '',
          'entered pass code was not cleared');
        assert.isTrue(subject.states.passCodeErrorTimeoutPending === false,
          'timeout error state was not cleared');
      });
      teardown(function() {
        stubUpdatePassCodeUI.restore();
      });
    });

    suite('lockscreen-inputappopened >', function() {
      var stubUpdatePassCodeUI;
      setup(function() {
        stubUpdatePassCodeUI =
          sinon.stub(subject, 'updatePassCodeUI');
      });
      test('it would update UI', function() {
        subject.handleEvent(
          new CustomEvent('lockscreen-inputappopened'));
        assert.isTrue(stubUpdatePassCodeUI.called,
          'the |updatePassCodeUI| method wasn\'t called');
      });
      teardown(function() {
        stubUpdatePassCodeUI.restore();
      });
    });

    suite('lockscreen-inputappclosed >', function() {
      // Currently identical to inputappopened
      var stubUpdatePassCodeUI;
      setup(function() {
        stubUpdatePassCodeUI =
          sinon.stub(subject, 'updatePassCodeUI');
      });
      test('it would reset UI', function() {
        subject.handleEvent(
          new CustomEvent('lockscreen-inputappclosed'));
        assert.isTrue(stubUpdatePassCodeUI.called,
          'the |updatePassCodeUI| method wasn\'t called');
      });
      teardown(function() {
        stubUpdatePassCodeUI.restore();
      });
    });

    suite('typing', function() {
      var evt;
      setup(function() {
        evt = {
          type: 'click',
          preventDefault: function() {}
        };
        evt.target = {
          tagName: 'DIV',
          parentNode: {
            dataset: {
              key: 'f'
            },
            tagName: 'A'
          },
          dataset: {}
        };

      });
      test('it would get the key', function() {
        var stubHandlePassCodeInput = sinon.stub(subject,
          'handlePassCodeInput');
        subject.handleEvent(evt);
        assert.isTrue(stubHandlePassCodeInput.calledWith('f'));
      });
      test('it would clear notification opening ID', function() {
        var method = subject.handlePassCodeInput;
        var mockThis = {
          lockScreen: {
            invokeSecureApp: function() {},
            _unlockingMessage: {
              notificationId: 'fakeid'
            }
          },
          dispatchEvent: function() {}
        };
        method.call(mockThis, 'e');
        assert.isUndefined(
          mockThis.lockScreen._unlockingMessage.notificationId);
        mockThis.lockScreen._unlockingMessage.notificationId = 'fakeid';
        method.call(mockThis, 'c');
        assert.isUndefined(
          mockThis.lockScreen._unlockingMessage.notificationId);
      });
    });
  });
});
