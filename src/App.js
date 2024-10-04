import React, { useState, useEffect, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Box, Sphere, Plane } from '@react-three/drei';
import * as THREE from 'three';

// Function to generate a dynamic maze layout based on dimensions
const generateMaze = (rows, cols) => {
  const maze = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => 1) // Initialize with walls (1)
  );

  const carvePassagesFrom = (cx, cy, maze) => {
    const directions = [
      [-2, 0], // up
      [2, 0],  // down
      [0, -2], // left
      [0, 2],  // right
    ];

    directions.sort(() => Math.random() - 0.5); // Shuffle directions

    directions.forEach(([dx, dz]) => {
      const nx = cx + dx;
      const ny = cy + dz;

      // Check if within bounds
      if (nx > 0 && nx < rows && ny > 0 && ny < cols && maze[nx][ny] === 1) {
        maze[nx][ny] = 0; // Carve a path
        maze[cx + dx / 2][cy + dz / 2] = 0; // Carve the wall between
        carvePassagesFrom(nx, ny, maze);
      }
    });
  };

  // Start the maze generation from [1, 1]
  maze[1][1] = 0;
  carvePassagesFrom(1, 1, maze);

  return maze;
};

// Get wall positions based on the dynamically generated maze
const getWallPositions = (mazeLayout) => {
  const positions = [];
  for (let i = 0; i < mazeLayout.length; i++) {
    for (let j = 0; j < mazeLayout[i].length; j++) {
      if (mazeLayout[i][j] === 1) {
        positions.push([i, 0, j]);
      }
    }
  }
  return positions;
};

// Player component with movement logic
function Player({ mazeLayout, goalPosition, onReachGoal }) {
  const [position, setPosition] = useState([1, 0.5, 1]); // Initial player position
  const playerRef = useRef();
  const speed = 0.1;

  useFrame(() => {
    if (playerRef.current) {
      playerRef.current.position.lerp(new THREE.Vector3(...position), 0.1);
    }
  });

  const handleKeyDown = (event) => {
    const [x, y, z] = position;
    let newPosition = [x, y, z];

    switch (event.key) {
      case 'ArrowUp':
      case 'w':
        newPosition = [x, y, z - speed];
        break;
      case 'ArrowDown':
      case 's':
        newPosition = [x, y, z + speed];
        break;
      case 'ArrowLeft':
      case 'a':
        newPosition = [x - speed, y, z];
        break;
      case 'ArrowRight':
      case 'd':
        newPosition = [x + speed, y, z];
        break;
      default:
        break;
    }

    const collision = mazeLayout.some((row, i) =>
      row.some((cell, j) => cell === 1 && Math.abs(newPosition[0] - i) < 0.5 && Math.abs(newPosition[2] - j) < 0.5)
    );

    if (!collision) {
      setPosition(newPosition);
    }
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [position]);

  useEffect(() => {
    // Adjust goal check to be accurate based on player's position
    const [px, , pz] = position;
    const [gx, , gz] = goalPosition; // Use goalPosition passed as a prop
    if (Math.abs(px - gx) < 0.2 && Math.abs(pz - gz) < 0.2) { // Adjust margin for win condition
      onReachGoal(); // Trigger win condition
    }
  }, [position, goalPosition, onReachGoal]);

  return (
    <group ref={playerRef} position={position}>
      <Box args={[0.5, 1, 0.5]}>
        <meshStandardMaterial attach="material" color="white" />
      </Box>
      <Sphere args={[0.3]} position={[0, 0.8, 0]}>
        <meshStandardMaterial attach="material" color="white" />
      </Sphere>
    </group>
  );
}

function App() {
  const [mazeLayout, setMazeLayout] = useState([]);
  const [wallPositions, setWallPositions] = useState([]);
  const [goalPosition, setGoalPosition] = useState([8, 0.5, 8]); // Default goal position
  const [gameStatus, setGameStatus] = useState('Playing');
  const [dimensions, setDimensions] = useState({ rows: 10, cols: 10 });

  const handleResize = () => {
    const rows = Math.floor(window.innerHeight / 40);
    const cols = Math.floor(window.innerWidth / 40);
    const mazeSize = Math.min(rows, cols);
    setDimensions({ rows: mazeSize, cols: mazeSize });
  };

  useEffect(() => {
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const newMaze = generateMaze(dimensions.rows, dimensions.cols);
    setMazeLayout(newMaze);
    setWallPositions(getWallPositions(newMaze));
    setGoalPosition([dimensions.rows - 2, 0.5, dimensions.cols - 2]); // Dynamic goal position based on maze size
  }, [dimensions]);

  const handleWin = () => {
    setGameStatus('Won'); // Set the game status to 'Won' when the goal is reached
  };

  const resetGame = () => {
    setGameStatus('Playing');
    const newMaze = generateMaze(dimensions.rows, dimensions.cols);
    setMazeLayout(newMaze);
    setWallPositions(getWallPositions(newMaze));
    setGoalPosition([dimensions.rows - 2, 0.5, dimensions.cols - 2]);
  };

  // Custom camera for orthographic view
  const CustomCamera = () => {
    const { camera, size } = useThree();

    const zoomFactor = Math.min(size.width / (dimensions.cols * 2), size.height / (dimensions.rows * 2));
    camera.zoom = zoomFactor;
    camera.position.set(dimensions.cols / 2, 20, dimensions.rows / 2); // Ensure the camera is directly above the maze for top-down view
    camera.lookAt(dimensions.cols / 2, 0, dimensions.rows / 2); // Look at the center of the maze
    camera.updateProjectionMatrix();

    return null;
  };

  return (
    <>
      {gameStatus === 'Playing' ? (
        <>
          <div style={{ position: 'absolute', top: '10px', left: '10px', color: 'white' }}>
            <p>Use W (up), A (left), S (down), D (right) to navigate</p>
          </div>
          <Canvas
            orthographic
            style={{ height: '100vh', width: '100vw', background: '#000' }} // Set black background for contrast
          >
            <CustomCamera />
            {/* Lighting Effects */}
            <ambientLight intensity={0.5} />
            <directionalLight position={[0, 5, 5]} />

            {/* Maze Walls */}
            {wallPositions.map((position, index) => (
              <Box key={index} args={[1, 1, 1]} position={position}>
                <meshStandardMaterial attach="material" color="blue" />
              </Box>
            ))}

            {/* Player */}
            <Player mazeLayout={mazeLayout} goalPosition={goalPosition} onReachGoal={handleWin} />

            {/* Goal with Visual Effect */}
            <mesh position={goalPosition}>
              <coneGeometry args={[0.3, 1, 32]} />
              <meshStandardMaterial color="red" emissive="orange" />
            </mesh>

            {/* Ground Plane */}
            <Plane
              args={[dimensions.cols, dimensions.rows]}
              rotation={[-Math.PI / 2, 0, 0]}
              position={[dimensions.cols / 2, -0.5, dimensions.rows / 2]} // Center the ground plane
            >
              <meshStandardMaterial attach="material" color="green" />
            </Plane>
          </Canvas>
        </>
      ) : (
        <div style={{ textAlign: 'center', marginTop: '20vh' }}>
          <h1>You Win!</h1>
          <button onClick={resetGame}>Play Again</button>
        </div>
      )}
    </>
  );
}

export default App;
