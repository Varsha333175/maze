import React, { useState, useEffect, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Box, Sphere, Plane, Cylinder } from '@react-three/drei';
import * as THREE from 'three';

// Function to generate a dynamic maze layout with multiple paths
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
      if (nx > 0 && nx < rows - 1 && ny > 0 && ny < cols - 1 && maze[nx][ny] === 1) {
        maze[nx][ny] = 0; // Carve a path
        maze[cx + dx / 2][cy + dz / 2] = 0; // Carve the wall between
        carvePassagesFrom(nx, ny, maze);
      }
    });

    // Add a chance to create multiple paths
    if (Math.random() > 0.7) {
      const extraDirections = [
        [-2, 0], [2, 0], [0, -2], [0, 2]
      ];

      extraDirections.forEach(([dx, dz]) => {
        const nx = cx + dx;
        const ny = cy + dz;
        if (nx > 0 && nx < rows - 1 && ny > 0 && ny < cols - 1) {
          maze[cx + dx / 2][cy + dz / 2] = 0; // Create additional random paths
        }
      });
    }
  };

  // Start the maze generation from [1, 1]
  maze[1][1] = 0;
  carvePassagesFrom(1, 1, maze);

  // Ensure outer boundaries remain intact
  for (let i = 0; i < rows; i++) {
    maze[i][0] = 1; // Left boundary
    maze[i][cols - 1] = 1; // Right boundary
  }

  for (let j = 0; j < cols; j++) {
    maze[0][j] = 1; // Top boundary
    maze[rows - 1][j] = 1; // Bottom boundary
  }

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

// Get a valid goal position that is not a wall
const getValidGoalPosition = (mazeLayout) => {
  for (let i = mazeLayout.length - 1; i > 0; i--) {
    for (let j = mazeLayout[i].length - 1; j > 0; j--) {
      if (mazeLayout[i][j] === 0) { // Find the last open cell
        return [i, 0.5, j];
      }
    }
  }
  return [mazeLayout.length - 2, 0.5, mazeLayout[0].length - 2];
};

// Function to find the shortest path using BFS
const findShortestPath = (maze, start, goal) => {
  const [rows, cols] = [maze.length, maze[0].length];
  const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const queue = [[start]];
  const visited = Array.from({ length: rows }, () => Array(cols).fill(false));
  visited[start[0]][start[2]] = true;

  while (queue.length > 0) {
    const path = queue.shift();
    const [x, , z] = path[path.length - 1]; // Current position

    if (x === goal[0] && z === goal[2]) return path; // Reached the goal

    for (const [dx, dz] of directions) {
      const [nx, nz] = [x + dx, z + dz];

      if (nx >= 0 && nx < rows && nz >= 0 && nz < cols && maze[nx][nz] === 0 && !visited[nx][nz]) {
        visited[nx][nz] = true;
        queue.push([...path, [nx, 0.5, nz]]);
      }
    }
  }
  return null; // No path found
};

// Arrow component to show trace of movement
const Arrow = ({ position, direction, color = "yellow" }) => {
  // Direction is an angle for rotation
  return (
    <Cylinder
      position={position}
      args={[0.1, 0.1, 0.5, 8]}
      rotation={[0, direction, Math.PI / 2]}
    >
      <meshStandardMaterial attach="material" color={color} />
    </Cylinder>
  );
};

// Player component with movement logic and trace leaving
function Player({ mazeLayout, goalPosition, onReachGoal, shortestPath }) {
  const [position, setPosition] = useState([1, 0.5, 1]); // Initial player position
  const [playerPath, setPlayerPath] = useState([[1, 0.5, 1]]); // Track player path
  const [traces, setTraces] = useState([]); // Track the direction of movement (for arrows)
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
    let direction = 0; // Direction in radians

    switch (event.key) {
      case 'ArrowUp':
      case 'w':
        newPosition = [x, y, z - 1];
        direction = Math.PI; // Up
        break;
      case 'ArrowDown':
      case 's':
        newPosition = [x, y, z + 1];
        direction = 0; // Down
        break;
      case 'ArrowLeft':
      case 'a':
        newPosition = [x - 1, y, z];
        direction = Math.PI / 2; // Left
        break;
      case 'ArrowRight':
      case 'd':
        newPosition = [x + 1, y, z];
        direction = -Math.PI / 2; // Right
        break;
      default:
        break;
    }

    const collision = mazeLayout.some((row, i) =>
      row.some((cell, j) => cell === 1 && Math.abs(newPosition[0] - i) < 0.5 && Math.abs(newPosition[2] - j) < 0.5)
    );

    if (!collision) {
      setPosition(newPosition);
      setPlayerPath([...playerPath, newPosition]);
      setTraces([...traces, { position: newPosition, direction }]); // Add trace
    }
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [position]);

  useEffect(() => {
    const [px, , pz] = position;
    const [gx, , gz] = goalPosition;
    if (Math.abs(px - gx) < 0.2 && Math.abs(pz - gz) < 0.2) {
      onReachGoal(playerPath); // Check if player path is the shortest
    }
  }, [position, goalPosition, playerPath, onReachGoal]);

  return (
    <>
      <group ref={playerRef} position={position}>
        <Box args={[0.5, 1, 0.5]}>
          <meshStandardMaterial attach="material" color="white" />
        </Box>
        <Sphere args={[0.3]} position={[0, 0.8, 0]}>
          <meshStandardMaterial attach="material" color="white" />
        </Sphere>
      </group>

      {/* Render traces (arrows) for player's movement */}
      {traces.map((trace, index) => (
        <Arrow key={index} position={trace.position} direction={trace.direction} />
      ))}
    </>
  );
}

function App() {
  const [mazeLayout, setMazeLayout] = useState([]);
  const [wallPositions, setWallPositions] = useState([]);
  const [goalPosition, setGoalPosition] = useState([8, 0.5, 8]); // Default goal position
  const [gameStatus, setGameStatus] = useState('Playing');
  const [dimensions, setDimensions] = useState({ rows: 10, cols: 10 });
  const [shortestPath, setShortestPath] = useState([]);
  const [previousMaze, setPreviousMaze] = useState(null);

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
    if (!previousMaze) {
      // Generate a new maze if there is no saved previous maze
      const newMaze = generateMaze(dimensions.rows, dimensions.cols);
      setMazeLayout(newMaze);
      setWallPositions(getWallPositions(newMaze));
      const validGoalPosition = getValidGoalPosition(newMaze);
      setGoalPosition(validGoalPosition);

      const shortest = findShortestPath(newMaze, [1, 0.5, 1], validGoalPosition);
      setShortestPath(shortest); // Store the shortest path
      setPreviousMaze(newMaze); // Save the current maze
    } else {
      // Use the saved maze
      setMazeLayout(previousMaze);
      setWallPositions(getWallPositions(previousMaze));
      const validGoalPosition = getValidGoalPosition(previousMaze);
      setGoalPosition(validGoalPosition);

      const shortest = findShortestPath(previousMaze, [1, 0.5, 1], validGoalPosition);
      setShortestPath(shortest);
    }
  }, [dimensions, previousMaze]);

  const handleWin = (playerPath) => {
    if (JSON.stringify(playerPath) === JSON.stringify(shortestPath)) {
      setGameStatus('Won via Shortest Path'); // Player took the shortest path
    } else {
      setGameStatus('Not the Shortest Path'); // Player didn't take the shortest path
    }
  };

  const retryGame = () => {
    // Retry with the same maze
    setGameStatus('Playing');
  };

  const newGame = () => {
    // Start a new game with a new maze
    setPreviousMaze(null); // Clear previous maze to generate a new one
    setGameStatus('Playing');
  };

  const CustomCamera = () => {
    const { camera, size } = useThree();
    const zoomFactor = Math.min(size.width / (dimensions.cols * 2), size.height / (dimensions.rows * 2));
    camera.zoom = zoomFactor;
    camera.position.set(dimensions.cols / 2, 20, dimensions.rows / 2);
    camera.lookAt(dimensions.cols / 2, 0, dimensions.rows / 2);
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
          <Canvas orthographic style={{ height: '100vh', width: '100vw', background: '#000' }}>
            <CustomCamera />
            <ambientLight intensity={0.5} />
            <directionalLight position={[0, 5, 5]} />

            {wallPositions.map((position, index) => (
              <Box key={index} args={[1, 1, 1]} position={position}>
                <meshStandardMaterial attach="material" color="blue" />
              </Box>
            ))}

            {/* Render shortest path as green arrows */}
            {shortestPath.map((pos, index) => (
              <Arrow key={index} position={pos} direction={0} color="green" />
            ))}

            <Player mazeLayout={mazeLayout} goalPosition={goalPosition} onReachGoal={handleWin} shortestPath={shortestPath} />

            <mesh position={goalPosition}>
              <coneGeometry args={[0.3, 1, 32]} />
              <meshStandardMaterial color="red" emissive="orange" />
            </mesh>

            <Plane args={[dimensions.cols, dimensions.rows]} rotation={[-Math.PI / 2, 0, 0]} position={[dimensions.cols / 2, -0.5, dimensions.rows / 2]}>
              <meshStandardMaterial attach="material" color="green" />
            </Plane>
          </Canvas>
        </>
      ) : (
        <div style={{ textAlign: 'center', marginTop: '20vh' }}>
          <h1>{gameStatus === 'Won via Shortest Path' ? 'You have reached the goal via the shortest path!' : 'This is not the shortest path.'}</h1>
          <button onClick={retryGame}>Retry</button>
          <button onClick={newGame}>New Game</button>
        </div>
      )}
    </>
  );
}

export default App;
