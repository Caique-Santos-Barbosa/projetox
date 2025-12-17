import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Animated,
  Dimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as FaceDetector from 'expo-face-detector';
import * as ImageManipulator from 'expo-image-manipulator';

// ⚠️ CONFIGURE A URL DO SEU SERVIDOR AQUI
const API_URL = 'https://seu-servidor.easypanel.host';

const { width, height } = Dimensions.get('window');

export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const [isScanning, setIsScanning] = useState(false);
  const [status, setStatus] = useState('idle'); // idle, scanning, success, error
  const [message, setMessage] = useState('');
  const [userName, setUserName] = useState('');
  const [frames, setFrames] = useState([]);
  const [faceDetected, setFaceDetected] = useState(false);
  
  const cameraRef = useRef(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const successAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isScanning) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.2, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isScanning]);

  useEffect(() => {
    if (status === 'success') {
      Animated.spring(successAnim, { toValue: 1, useNativeDriver: true }).start();
      setTimeout(() => {
        successAnim.setValue(0);
        setStatus('idle');
        setUserName('');
      }, 4000);
    }
  }, [status]);

  const handleFacesDetected = ({ faces }) => {
    setFaceDetected(faces.length > 0);
  };

  const captureFrames = async () => {
    if (!cameraRef.current || isScanning) return;
    
    setIsScanning(true);
    setStatus('scanning');
    setMessage('Detectando vivacidade...');
    setFrames([]);

    const capturedFrames = [];
    
    try {
      // Capture multiple frames for liveness detection
      for (let i = 0; i < 5; i++) {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.5,
          base64: true,
          skipProcessing: true,
        });
        
        // Resize for faster upload
        const manipulated = await ImageManipulator.manipulateAsync(
          photo.uri,
          [{ resize: { width: 400 } }],
          { base64: true, format: ImageManipulator.SaveFormat.JPEG, compress: 0.7 }
        );
        
        capturedFrames.push(manipulated.base64);
        setMessage(`Capturando... ${i + 1}/5`);
        await new Promise(r => setTimeout(r, 300));
      }

      setMessage('Verificando...');
      
      // Send to API
      const response = await fetch(`${API_URL}/api/verify-liveness`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images: capturedFrames }),
      });

      const result = await response.json();

      if (result.verified && result.liveness) {
        setStatus('success');
        setUserName(result.user.name);
        setMessage(`✓ Acesso Liberado\n${result.user.name}\nConfiança: ${result.confidence}%`);
      } else if (!result.liveness) {
        setStatus('error');
        setMessage('❌ Verificação de vivacidade falhou\nPor favor, mova levemente o rosto');
      } else {
        setStatus('error');
        setMessage('❌ Usuário não reconhecido');
      }
    } catch (error) {
      setStatus('error');
      setMessage('Erro de conexão com servidor');
      console.error(error);
    }

    setIsScanning(false);
    
    if (status !== 'success') {
      setTimeout(() => {
        setStatus('idle');
        setMessage('');
      }, 3000);
    }
  };

  if (!permission) {
    return <View style={styles.container}><ActivityIndicator size="large" color="#00d4aa" /></View>;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>🔐 Face Access</Text>
        <Text style={styles.subtitle}>Precisamos de acesso à câmera para reconhecimento facial</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Permitir Câmera</Text>
        </TouchableOpacity>
        <StatusBar style="light" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      <View style={styles.header}>
        <Text style={styles.title}>🔐 Face Access</Text>
        <Text style={styles.subtitle}>Posicione seu rosto no centro</Text>
      </View>

      <View style={styles.cameraContainer}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing="front"
          onFacesDetected={handleFacesDetected}
          faceDetectorSettings={{
            mode: FaceDetector.FaceDetectorMode.fast,
            detectLandmarks: FaceDetector.FaceDetectorLandmarks.none,
            runClassifications: FaceDetector.FaceDetectorClassifications.none,
            minDetectionInterval: 100,
            tracking: true,
          }}
        >
          <Animated.View 
            style={[
              styles.faceFrame,
              { 
                transform: [{ scale: pulseAnim }],
                borderColor: faceDetected ? '#00d4aa' : '#ffffff50'
              }
            ]} 
          />
          
          {status === 'success' && (
            <Animated.View 
              style={[
                styles.successOverlay,
                { opacity: successAnim, transform: [{ scale: successAnim }] }
              ]}
            >
              <Text style={styles.successIcon}>✓</Text>
              <Text style={styles.successName}>{userName}</Text>
              <Text style={styles.successText}>Acesso Liberado</Text>
            </Animated.View>
          )}
        </CameraView>
      </View>

      <View style={styles.statusContainer}>
        {faceDetected && status === 'idle' && (
          <View style={styles.faceIndicator}>
            <View style={styles.faceIndicatorDot} />
            <Text style={styles.faceIndicatorText}>Rosto detectado</Text>
          </View>
        )}
        
        {message ? (
          <Text style={[
            styles.message,
            status === 'success' && styles.messageSuccess,
            status === 'error' && styles.messageError
          ]}>
            {message}
          </Text>
        ) : null}
      </View>

      <TouchableOpacity
        style={[
          styles.scanButton,
          isScanning && styles.scanButtonDisabled,
          !faceDetected && styles.scanButtonDisabled
        ]}
        onPress={captureFrames}
        disabled={isScanning || !faceDetected}
      >
        {isScanning ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.scanButtonText}>
            {faceDetected ? '🔍 Verificar Acesso' : 'Posicione o rosto'}
          </Text>
        )}
      </TouchableOpacity>

      <Text style={styles.footer}>
        Mova levemente o rosto durante a verificação
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#8888a0',
  },
  cameraContainer: {
    width: width * 0.85,
    height: width * 0.85,
    borderRadius: 30,
    overflow: 'hidden',
    backgroundColor: '#1a1a25',
  },
  camera: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  faceFrame: {
    width: 220,
    height: 280,
    borderWidth: 3,
    borderRadius: 120,
    borderStyle: 'dashed',
  },
  successOverlay: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 212, 170, 0.95)',
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  successIcon: {
    fontSize: 80,
    color: '#fff',
    marginBottom: 10,
  },
  successName: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 5,
  },
  successText: {
    fontSize: 18,
    color: '#fff',
  },
  statusContainer: {
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 20,
  },
  faceIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 212, 170, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  faceIndicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00d4aa',
    marginRight: 8,
  },
  faceIndicatorText: {
    color: '#00d4aa',
    fontWeight: '600',
  },
  message: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    lineHeight: 24,
  },
  messageSuccess: {
    color: '#00d4aa',
  },
  messageError: {
    color: '#ff4466',
  },
  scanButton: {
    backgroundColor: '#00d4aa',
    paddingHorizontal: 40,
    paddingVertical: 18,
    borderRadius: 30,
    shadowColor: '#00d4aa',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 15,
    elevation: 8,
  },
  scanButtonDisabled: {
    backgroundColor: '#333',
    shadowOpacity: 0,
  },
  scanButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  footer: {
    position: 'absolute',
    bottom: 40,
    color: '#8888a0',
    fontSize: 13,
  },
  button: {
    backgroundColor: '#00d4aa',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
    marginTop: 20,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

