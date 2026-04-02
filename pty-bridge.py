#!/usr/bin/env python3
"""
PTY bridge: spawns a command in a real pseudo-terminal and bridges
stdin/stdout so Node.js can interact with it.
Usage: python3 pty-bridge.py <cols> <rows> <cwd> <command> [args...]
"""
import sys, os, pty, select, signal, struct, fcntl, termios

def set_winsize(fd, rows, cols):
    winsize = struct.pack('HHHH', rows, cols, 0, 0)
    fcntl.ioctl(fd, termios.TIOCSWINSZ, winsize)

def main():
    if len(sys.argv) < 5:
        print("Usage: pty-bridge.py <cols> <rows> <cwd> <command> [args...]", file=sys.stderr)
        sys.exit(1)

    cols = int(sys.argv[1])
    rows = int(sys.argv[2])
    cwd = sys.argv[3]
    cmd = sys.argv[4:]

    # Create PTY
    master_fd, slave_fd = pty.openpty()
    set_winsize(master_fd, rows, cols)

    pid = os.fork()
    if pid == 0:
        # Child process
        os.setsid()
        os.close(master_fd)

        # Set slave as controlling terminal
        fcntl.ioctl(slave_fd, termios.TIOCSCTTY, 0)

        os.dup2(slave_fd, 0)
        os.dup2(slave_fd, 1)
        os.dup2(slave_fd, 2)
        if slave_fd > 2:
            os.close(slave_fd)

        os.chdir(cwd)
        os.environ['TERM'] = 'xterm-256color'
        os.environ['FORCE_COLOR'] = '1'
        # Ensure node/homebrew are in PATH
        path = os.environ.get('PATH', '')
        for p in ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin']:
            if p not in path:
                path = p + ':' + path
        os.environ['PATH'] = path
        os.environ['COLUMNS'] = str(cols)
        os.environ['LINES'] = str(rows)

        os.execvp(cmd[0], cmd)
    else:
        # Parent process
        os.close(slave_fd)

        # Make stdin non-blocking
        stdin_fd = sys.stdin.fileno()
        stdout_fd = sys.stdout.fileno()

        # Set stdout to binary/unbuffered
        sys.stdout = os.fdopen(stdout_fd, 'wb', 0)
        sys.stdin = os.fdopen(stdin_fd, 'rb', 0)

        # Handle SIGWINCH (resize) via a signal byte on a pipe
        resize_r, resize_w = os.pipe()

        def handle_sigwinch(signum, frame):
            # Read new size from stdin as a special escape sequence
            pass
        signal.signal(signal.SIGCHLD, signal.SIG_DFL)

        try:
            while True:
                rlist = [master_fd, stdin_fd]
                try:
                    readable, _, _ = select.select(rlist, [], [], 0.1)
                except (select.error, InterruptedError):
                    continue

                if master_fd in readable:
                    try:
                        data = os.read(master_fd, 65536)
                        if not data:
                            break
                        sys.stdout.write(data)
                    except OSError:
                        break

                if stdin_fd in readable:
                    try:
                        data = os.read(stdin_fd, 65536)
                        if not data:
                            break

                        # Check for resize escape: \x1b[R<cols>;<rows>\x00
                        if data.startswith(b'\x1b[R') and b'\x00' in data:
                            end = data.index(b'\x00')
                            resize_str = data[3:end].decode()
                            rest = data[end+1:]
                            try:
                                c, r = resize_str.split(';')
                                set_winsize(master_fd, int(r), int(c))
                                signal.raise_signal(signal.SIGWINCH) if hasattr(signal, 'raise_signal') else os.kill(pid, signal.SIGWINCH)
                            except ValueError:
                                pass
                            if rest:
                                os.write(master_fd, rest)
                        else:
                            os.write(master_fd, data)
                    except OSError:
                        break

                # Check if child is still alive
                result = os.waitpid(pid, os.WNOHANG)
                if result[0] != 0:
                    # Drain remaining output
                    while True:
                        try:
                            readable, _, _ = select.select([master_fd], [], [], 0.1)
                            if master_fd in readable:
                                data = os.read(master_fd, 65536)
                                if data:
                                    sys.stdout.write(data)
                                else:
                                    break
                            else:
                                break
                        except OSError:
                            break
                    break
        except KeyboardInterrupt:
            os.kill(pid, signal.SIGTERM)
        finally:
            os.close(master_fd)
            try:
                os.waitpid(pid, 0)
            except ChildProcessError:
                pass

if __name__ == '__main__':
    main()
