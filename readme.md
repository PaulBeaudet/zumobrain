This is an Cordova Android App to control an Arduino powered telepresence robot

To make this application work the following are needed
* An Android phone, put it in debugging mode
* Cordova (/phonegap/ionic/w.e.) with the Android SDK put in its build path
* Cordova plugin for communicating with Arduinos- [cordovarduino](https://github.com/xseignard/cordovarduino)
* Web app for control and telepresence- [telezumo](https://github.com/PaulBeaudet/telezumo)
* An Arduino powered robot like the [Zumo](https://www.pololu.com/category/129/zumo-robots-and-accessories)
* Code for your Arduino powered robot [zumoTesting](https://github.com/PaulBeaudet/zumoTesting)

In order to set up this application. Once cordova and Android SDK installed properly, open your terminal and navigate into zumobrain and run

```cordova prepare```

To push the application on an android device run

```cordova run android```


Copyright 2016 Paul Beaudet MIT License

