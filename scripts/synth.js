Gibberish.synth = function() {
  this.type = 'oscillator';
    
  this.oscillatorInit = function() {
    this.fx = new Array2; 
    this.fx.parent = this;
  };
};
Gibberish.synth.prototype = new Gibberish.ugen();
Gibberish._synth = new Gibberish.synth();

/**#Gibberish.Synth - Synth
Oscillator + attack / decay envelope.
  
## Example Usage##
`Gibberish.init();  
a = new Gibberish.Synth({ attack:44, decay:44100 }).connect();  
a.note(880);  
a.waveform = "Triangle";  
`  
## Constructor   
**param** *properties*: Object. A dictionary of property values (see below) to set for the synth on initialization.
- - - -
**/
/**###Gibberish.Synth.frequency : property  
Number. The frequency for the carrier oscillator. This is normally set using the note method but can also be modulated.
**/
/**###Gibberish.Synth.pulsewidth : property  
Number. The duty cycle for PWM synthesis
**/
/**###Gibberish.Synth.attack : property  
Number. The length of the attack portion of the envelope in samples. Note that the synth's envelope affects both amplitude and the index of the synth.
**/
/**###Gibberish.Synth.decay : property  
Number. The length of the decay portion of the envelope in samples. Note that the synth's envelope affects both amplitude and the index of the synth.
**/
/**###Gibberish.Synth.glide : property  
Number. The synth has a one-pole filter attached to the carrier frequency. Set glide to a value between .999 and 1 to get pitch sweep between notes.
**/
/**###Gibberish.Synth.amp : property  
Number. The relative amplitude level of the synth.
**/
/**###Gibberish.Synth.channels : property  
Number. Default 2. Mono or Stereo synthesis.
**/
/**###Gibberish.Synth.pan : property  
Number. Default 0. If the synth has two channels, this determines its position in the stereo spectrum.
**/
/**###Gibberish.Synth.waveform : property  
String. The type of waveform to use. Options include 'Sine', 'Triangle', 'PWM', 'Saw' etc.
**/
		
Gibberish.Synth = function(properties) {
	this.name =	"synth";

	this.properties = {
	  frequency:0,
    pulsewidth:.5,
	  attack:		22050,
	  decay:		22050,
    glide:    .15,
    amp:		  .25,
    channels: 2,
	  pan:		  0,
    sr:       Gibberish.context.sampleRate
  };
/**###Gibberish.Synth.note : method  
Generate an enveloped note at the provided frequency  
  
param **frequency** Number. The frequency for the oscillator.  
param **amp** Number. Optional. The volume to use.  
**/    
	this.note = function(frequency, amp) {
		if(typeof this.frequency !== 'object'){
      this.frequency = frequency;
      _frequency = frequency;
    }else{
      this.frequency[0] = frequency;
      _frequency = frequency;
      Gibberish.dirty(this);
    }
					
		if(typeof amp !== 'undefined') this.amp = amp;
					
    _envelope.run();
	};
  
	var _envelope   = new Gibberish.AD(),
      envstate    = _envelope.getState,
      envelope    = _envelope.callback,
      _osc        = new Gibberish.PWM(),
	    osc         = _osc.callback,
      lag         = new Gibberish.OnePole().callback,
    	panner      = Gibberish.makePanner(),
    	out         = [0,0];

  this.callback = function(frequency, pulsewidth, attack, decay, glide, amp, channels, pan, sr) {
    glide = glide >= 1 ? .99999 : glide;
    frequency = lag(frequency, 1-glide, glide);
    
		if(envstate() < 2) {				
			var env = envelope(attack, decay);
			var val = osc( frequency, 1, pulsewidth, sr ) * env * amp;

			out[0] = out[1] = val;
      
			return channels === 1 ? val : panner(val, pan, out);
    }else{
		  val = out[0] = out[1] = 0;
      return channels === 1 ? val : panner(val, pan, out);
    }
	};
  
  this.getOsc = function() { return _osc; };
  this.setOsc = function(val) { _osc = val; osc = _osc.callback };
  
  var waveform = "PWM";
  Object.defineProperty(this, 'waveform', {
    get : function() { return waveform; },
    set : function(val) { this.setOsc( new Gibberish[val]() ); }
  });
  
  this.init();
  this.oscillatorInit();
	this.processProperties(arguments);
};
Gibberish.Synth.prototype = Gibberish._synth;

/**#Gibberish.PolySynth - Synth
A polyphonic version of [Synth](javascript:displayDocs('Gibberish.Synth'\)). There are two additional properties for the polyphonic version of the synth. The polyphonic version consists of multiple Synths being fed into a single [Bus](javascript:displayDocs('Gibberish.Bus'\)) object.
  
## Example Usage ##
`Gibberish.init();  
a = new Gibberish.PolySytn({ attack:88200, decay:88200, maxVoices:10 }).connect();  
a.note(880);  
a.note(1320); 
a.note(1760);  
`  
## Constructor   
One important property to pass to the constructor is the maxVoices property, which defaults to 5. This controls how many voices are allocated to the synth and cannot be changed after initialization.  
  
**param** *properties*: Object. A dictionary of property values (see below) to set for the synth on initialization.
- - - -
**/
/**###Gibberish.PolySynth.children : property  
Array. Read-only. An array holding all of the child FMSynth objects.
**/
/**###Gibberish.PolySynth.maxVoices : property  
Number. The number of voices of polyphony the synth has. May only be set in initialization properties passed to constrcutor.
**/
Gibberish.PolySynth = function() {
  this.__proto__ = new Gibberish.Bus2();
  
  Gibberish.extend(this, {
    name:     "polysynth",
    maxVoices:    5,
    voiceCount:   0,
    
    polyProperties : {
      frequency: 0,
  		glide:			0,
      attack: 22050,
      decay:  22050,
      pulsewidth:.5,
      waveform:"PWM",
    },

/**###Gibberish.PolySynth.note : method  
Generate an enveloped note at the provided frequency using a simple voice allocation system where if all children are active, the one active the longest cancels its current note and begins playing a new one.    
  
param **frequency** Number. The frequency for the oscillator. 
param **amp** Number. Optional. The volume to use.  
**/  
    note : function(_frequency, amp) {
      var synth = this.children[this.voiceCount++];
      if(this.voiceCount >= this.maxVoices) this.voiceCount = 0;
      synth.note(_frequency, amp);
    },
  });
  
  this.amp = 1 / this.maxVoices;
  this.processProperties(arguments);
  
  this.children = [];
  
  this.dirty = true;
  for(var i = 0; i < this.maxVoices; i++) {
    var props = {
      attack:   this.attack,
      decay:    this.decay,
      pulsewidth: this.pulsewidth,
      channels: 2,
      amp:      1,
    };
    var synth = new Gibberish.Synth(props);
    synth.connect(this);

    this.children.push(synth);
  }
  
  Gibberish.polyInit(this);
  Gibberish._synth.oscillatorInit.call(this);
};

/**#Gibberish.Synth2 - Synth
Oscillator + attack / decay envelope + 24db ladder filter. Basically the same as the [Synth](javascript:displayDocs('Gibberish.Synth'\)) object but with the addition of the filter. Note that the envelope controls both the amplitude of the oscillator and the cutoff frequency of the filter.
  
## Example Usage##
`Gibberish.init();  
a = new Gibberish.Synth2({ attack:44, decay:44100, cutoff:.2, resonance:4 }).connect();  
a.note(880);  
`  
## Constructor   
**param** *properties*: Object. A dictionary of property values (see below) to set for the synth on initialization.
- - - -
**/
/**###Gibberish.Synth2.frequency : property  
Number. The frequency for the carrier oscillator. This is normally set using the note method but can also be modulated.
**/
/**###Gibberish.Synth2.pulsewidth : property  
Number. The duty cycle for PWM synthesis
**/
/**###Gibberish.Synth2.attack : property  
Number. The length of the attack portion of the envelope in samples. Note that the synth's envelope affects both amplitude and the index of the synth.
**/
/**###Gibberish.Synth2.decay : property  
Number. The length of the decay portion of the envelope in samples. Note that the synth's envelope affects both amplitude and the index of the synth.
**/
/**###Gibberish.Synth2.cutoff : property  
Number. 0..1. The cutoff frequency for the synth's filter.
**/
/**###Gibberish.Synth2.resonance : property  
Number. 0..50. Values above 4.5 are likely to produce shrieking feedback. You are warned.
**/
/**###Gibberish.Synth2.useLowPassFilter : property  
Boolean. Default true. Whether to use a high-pass or low-pass filter.
**/
/**###Gibberish.Synth2.glide : property  
Number. The synth has a one-pole filter attached to the carrier frequency. Set glide to a value between .999 and 1 to get pitch sweep between notes.
**/
/**###Gibberish.Synth2.amp : property  
Number. The relative amplitude level of the synth.
**/
/**###Gibberish.Synth2.channels : property  
Number. Default 2. Mono or Stereo synthesis.
**/
/**###Gibberish.Synth2.pan : property  
Number. Default 0. If the synth has two channels, this determines its position in the stereo spectrum.
**/
/**###Gibberish.Synth2.waveform : property  
String. The type of waveform to use. Options include 'Sine', 'Triangle', 'PWM', 'Saw' etc.
**/
Gibberish.Synth2 = function(properties) {
	this.name =	"synth2";

	this.properties = {
	  frequency:0,
    pulsewidth:.5,
	  attack:		22050,
	  decay:		22050,
    cutoff:   .25,
    resonance:3.5,
    useLowPassFilter:true,
    glide:    .15,
    amp:		  .25,
    channels: 1,
	  pan:		  0,
    sr:       Gibberish.context.sampleRate,
  };
/**###Gibberish.Synth2.note : method  
Generate an enveloped note at the provided frequency  
  
param **frequency** Number. The frequency for the oscillator.  
param **amp** Number. Optional. The volume to use.  
**/      
	this.note = function(frequency, amp) {
		if(typeof this.frequency !== 'object'){
      this.frequency = frequency;
    }else{
      this.frequency[0] = frequency;
      Gibberish.dirty(this);      
    }
					
		if(typeof amp !== 'undefined') this.amp = amp;
					
    _envelope.run();
	};
  
	var _envelope   = new Gibberish.AD(),
      envstate    = _envelope.getState,
      envelope    = _envelope.callback,
      _osc        = new Gibberish.PWM(),
	    osc         = _osc.callback,      
      _filter     = new Gibberish.Filter24(),
      filter      = _filter.callback,
      lag         = new Gibberish.OnePole().callback,
    	panner      = Gibberish.makePanner(),
    	out         = [0,0];

  this.callback = function(frequency, pulsewidth, attack, decay, cutoff, resonance, isLowPass, glide, amp, channels, pan, sr) {
    //sample, cutoff, resonance, isLowPass
		if(envstate() < 2) {
      glide = glide >= 1 ? .99999 : glide;
      frequency = lag(frequency, 1-glide, glide);
      
			var env = envelope(attack, decay);
			var val = filter ( osc( frequency, .15, pulsewidth, sr ), cutoff * env, resonance, isLowPass ) * env * amp;

			out[0] = out[1] = val;
      
			return channels === 1 ? val : panner(val, pan, out);
    }else{
		  val = out[0] = out[1] = 0;
      return channels === 1 ? val : panner(val, pan, out);
    }
	};
  
  this.getOsc = function() { return _osc; };
  this.setOsc = function(val) { _osc = val; osc = _osc.callback };
  
  var waveform = "PWM";
  Object.defineProperty(this, 'waveform', {
    get : function() { return waveform; },
    set : function(val) { this.setOsc( new Gibberish[val]() ); }
  });
  
  this.init();
  this.oscillatorInit();
	this.processProperties(arguments);
};
Gibberish.Synth2.prototype = Gibberish._synth;

/**#Gibberish.PolySynth2 - Synth
A polyphonic version of [Synth2](javascript:displayDocs('Gibberish.Synth2'\)). There are two additional properties for the polyphonic version of the synth. The polyphonic version consists of multiple Synths being fed into a single [Bus](javascript:displayDocs('Gibberish.Bus'\)) object.
  
## Example Usage ##
`Gibberish.init();  
a = new Gibberish.PolySynth2({ attack:88200, decay:88200, maxVoices:10 }).connect();  
a.note(880);  
a.note(1320); 
a.note(1760);  
`  
## Constructor   
One important property to pass to the constructor is the maxVoices property, which defaults to 5. This controls how many voices are allocated to the synth and cannot be changed after initialization.  
  
**param** *properties*: Object. A dictionary of property values (see below) to set for the synth on initialization.
- - - -
**/
/**###Gibberish.PolySynth2.children : property  
Array. Read-only. An array holding all of the child FMSynth objects.
**/
/**###Gibberish.PolySynth2.maxVoices : property  
Number. The number of voices of polyphony the synth has. May only be set in initialization properties passed to constrcutor.
**/

Gibberish.PolySynth2 = function() {
  this.__proto__ = new Gibberish.Bus2();
  
  Gibberish.extend(this, {
    name:     "polysynth2",
    maxVoices:    5,
    voiceCount:   0,
    
    polyProperties : {
      frequency: 0,
  		glide:			0,
      attack: 22050,
      decay:  22050,
      pulsewidth:.5,
      waveform:"PWM",
    },

/**###Gibberish.PolySynth2.note : method  
Generate an enveloped note at the provided frequency using a simple voice allocation system where if all children are active, the one active the longest cancels its current note and begins playing a new one.    
  
param **frequency** Number. The frequency for the oscillator. 
param **amp** Number. Optional. The volume to use.  
**/  
    note : function(_frequency, amp) {
      var synth = this.children[this.voiceCount++];
      if(this.voiceCount >= this.maxVoices) this.voiceCount = 0;
      synth.note(_frequency, amp);
    },
  });
  
  this.amp = 1 / this.maxVoices;
  this.processProperties(arguments);
  
  this.children = [];
  
  this.dirty = true;
  for(var i = 0; i < this.maxVoices; i++) {
    var props = {
      attack:   this.attack,
      decay:    this.decay,
      pulsewidth: this.pulsewidth,
      channels: 2,
      amp:      1,
    };
    var synth = new Gibberish.Synth2(props);
    synth.connect(this);

    this.children.push(synth);
  }
  
  Gibberish.polyInit(this);
  Gibberish._synth.oscillatorInit.call(this);
};